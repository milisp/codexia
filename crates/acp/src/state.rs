use std::sync::Arc;
use std::sync::atomic::{AtomicU16, Ordering};

use codexia_shared::event_sink::EventSink;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::agents::{AcpAgentDef, find_preset};
use crate::client::{AcpClient, ConnectionPolicy};

/// Result of starting an agent: everything the UI needs to render the session.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpStartResult {
    pub connection_id: String,
    pub session_id: Option<String>,
    /// Raw `initialize` response (agentInfo, authMethods, agentCapabilities).
    pub initialize: Value,
    /// Raw `session/new` result: `modes`, `models`, `configOptions`.
    pub session: Option<Value>,
    /// Set when `session/new` failed, e.g. because the agent needs auth.
    pub session_error: Option<String>,
}

#[derive(Clone)]
pub struct AcpState {
    connections: Arc<DashMap<String, Arc<AcpClient>>>,
    sink: Arc<dyn EventSink>,
    /// Port of the Codexia API a bot's agent calls back into (the bots MCP
    /// server). The desktop's loopback server by default; a standalone web
    /// server sets its own.
    api_port: Arc<AtomicU16>,
}

impl AcpState {
    pub fn new(sink: Arc<dyn EventSink>) -> Self {
        Self {
            connections: Arc::new(DashMap::new()),
            sink,
            api_port: Arc::new(AtomicU16::new(crate::bots::LOCAL_PORT)),
        }
    }

    pub fn set_api_port(&self, port: u16) {
        self.api_port.store(port, Ordering::Relaxed);
    }

    pub fn api_port(&self) -> u16 {
        self.api_port.load(Ordering::Relaxed)
    }

    pub(crate) fn sink(&self) -> Arc<dyn EventSink> {
        self.sink.clone()
    }

    pub(crate) fn insert(&self, connection_id: String, client: Arc<AcpClient>) {
        self.connections.insert(connection_id, client);
    }

    /// Spawn `agent_id` (a preset id, or a custom definition) and open a session in `cwd`.
    pub async fn start(
        &self,
        agent_id: &str,
        cwd: &str,
        custom: Option<AcpAgentDef>,
        bot_id: Option<String>,
    ) -> Result<AcpStartResult, String> {
        // A bot is always built from its stored settings, so what the Bot tab
        // runs and what a routine runs cannot drift apart.
        let bot = match &bot_id {
            Some(id) => Some(
                codexia_db::bots::get_bot(id)?.ok_or_else(|| format!("No bot with id `{id}`"))?,
            ),
            None => None,
        };
        let (agent, policy) = match (&bot, custom) {
            (Some(bot), _) => (
                crate::bots::agent_def(bot)?,
                crate::bots::policy(bot, self.api_port(), false, true).await,
            ),
            (None, Some(a)) => (a, ConnectionPolicy::default()),
            (None, None) => (
                find_preset(agent_id).ok_or_else(|| format!("unknown ACP agent: {agent_id}"))?,
                ConnectionPolicy::default(),
            ),
        };

        let connection_id = uuid::Uuid::new_v4().to_string();
        let (client, initialize) = AcpClient::spawn(
            connection_id.clone(),
            &agent,
            Some(cwd),
            bot_id,
            policy,
            self.sink.clone(),
        )
        .await?;
        self.connections.insert(connection_id.clone(), client.clone());

        if let Some(bot) = &bot {
            crate::bots::select_provider(&client, bot).await;
        }
        let (session, session_error) = match client.new_session(cwd).await {
            Ok(session) => (Some(session), None),
            Err(e) => (None, Some(e)),
        };
        let session_id = session
            .as_ref()
            .and_then(|s| s.get("sessionId"))
            .and_then(Value::as_str)
            .map(str::to_string);
        if let (Some(bot), Some(session_id)) = (&bot, &session_id) {
            crate::bots::apply_settings(&client, session_id, bot).await;
        }

        Ok(AcpStartResult {
            connection_id,
            session_id,
            initialize,
            session,
            session_error,
        })
    }

    fn get(&self, connection_id: &str) -> Result<Arc<AcpClient>, String> {
        self.connections
            .get(connection_id)
            .map(|c| c.clone())
            .ok_or_else(|| format!("unknown ACP connection: {connection_id}"))
    }

    pub async fn prompt(
        &self,
        connection_id: &str,
        session_id: Option<&str>,
        text: &str,
    ) -> Result<Value, String> {
        self.get(connection_id)?.prompt(session_id, text).await
    }

    pub async fn cancel(
        &self,
        connection_id: &str,
        session_id: Option<&str>,
    ) -> Result<(), String> {
        self.get(connection_id)?.cancel(session_id).await
    }

    pub async fn authenticate(&self, connection_id: &str, method_id: &str) -> Result<(), String> {
        let client = self.get(connection_id)?;
        client.authenticate(method_id).await
    }

    /// Open a session on a connection that had to authenticate first.
    pub async fn new_session(&self, connection_id: &str, cwd: &str) -> Result<Value, String> {
        let client = self.get(connection_id)?;
        let session = client.new_session(cwd).await?;
        if let Some(session_id) = session.get("sessionId").and_then(Value::as_str) {
            self.apply_bot_settings(&client, session_id).await;
        }
        Ok(session)
    }

    /// A bot's settings belong on every session its process opens or resumes,
    /// not only the first one.
    async fn apply_bot_settings(&self, client: &AcpClient, session_id: &str) {
        let Some(bot_id) = client.bot_id.as_deref() else { return };
        match codexia_db::bots::get_bot(bot_id) {
            Ok(Some(bot)) => crate::bots::apply_settings(client, session_id, &bot).await,
            Ok(None) => {}
            Err(e) => log::warn!("acp: could not read bot {bot_id}: {e}"),
        }
    }

    /// Resume a stored session on a live connection. Fails for agents that do
    /// not advertise `agentCapabilities.loadSession`.
    pub async fn load_session(
        &self,
        connection_id: &str,
        session_id: &str,
        cwd: &str,
    ) -> Result<Value, String> {
        let client = self.get(connection_id)?;
        let session = client.load_session(session_id, cwd).await?;
        self.apply_bot_settings(&client, session_id).await;
        Ok(session)
    }

    pub async fn set_mode(
        &self,
        connection_id: &str,
        session_id: Option<&str>,
        mode_id: &str,
    ) -> Result<Value, String> {
        self.get(connection_id)?.set_mode(session_id, mode_id).await
    }

    pub async fn set_model(
        &self,
        connection_id: &str,
        session_id: Option<&str>,
        model_id: &str,
        reasoning_effort: Option<&str>,
    ) -> Result<Value, String> {
        self.get(connection_id)?
            .set_model(session_id, model_id, reasoning_effort)
            .await
    }

    pub async fn set_config_option(
        &self,
        connection_id: &str,
        session_id: Option<&str>,
        config_id: &str,
        value: &Value,
    ) -> Result<Value, String> {
        self.get(connection_id)?
            .set_config_option(session_id, config_id, value)
            .await
    }

    pub fn respond_permission(
        &self,
        connection_id: &str,
        request_id: &str,
        option_id: Option<String>,
    ) -> Result<(), String> {
        self.get(connection_id)?
            .respond_permission(request_id, option_id)
    }

    pub async fn stop(&self, connection_id: &str) -> Result<(), String> {
        if let Some((_, client)) = self.connections.remove(connection_id) {
            client.kill().await;
        }
        Ok(())
    }
}
