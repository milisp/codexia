use std::process::Stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};

use codexia_shared::event_sink::EventSink;
use dashmap::DashMap;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{Mutex, oneshot};

use crate::agents::AcpAgentDef;

/// Single event channel for everything an ACP connection produces.
/// Payloads always carry `connectionId` plus a `kind` discriminator.
pub const ACP_EVENT: &str = "acp-message";

/// The ACP protocol version we speak.
const PROTOCOL_VERSION: i64 = 1;

/// How a connection behaves beyond plain JSON-RPC plumbing. The default is an
/// interactive session with no extra servers, which is what every non-bot
/// connection gets.
#[derive(Clone, Default)]
pub struct ConnectionPolicy {
    /// Require keke's ACP-only client MCP policy and verify it during initialize.
    /// This stays off for ordinary ACP connections.
    pub strict_mcp: bool,
    /// ACP `McpServer` entries handed to every `session/new` and `session/load`.
    pub mcp_servers: Vec<Value>,
    /// Refuse the agent's `fs/write_text_file` requests. The agent's own
    /// sandbox only covers what it writes itself; a write it routes through
    /// the client would otherwise bypass a read-only bot's sandbox entirely.
    pub read_only: bool,
    /// Answer permission requests here instead of asking a person. Set for
    /// runs nobody is watching, where an unanswered request would hang the
    /// turn until it timed out.
    pub unattended: Option<UnattendedApprovals>,
}

impl ConnectionPolicy {
    fn revoke_delegation(&self) {
        for server in &self.mcp_servers {
            if server["name"] == "codexia-bots"
                && let Some(headers) = server["headers"].as_array()
            {
                for header in headers {
                    if header["name"] == "X-Codexia-Delegation" {
                        crate::delegation::revoke(header["value"].as_str().unwrap_or_default());
                    }
                }
            }
        }
    }
}

/// The standing answer for permission requests on an unattended connection.
#[derive(Clone, Default)]
pub struct UnattendedApprovals {
    /// Allow everything — an autonomous bot.
    pub allow_all: bool,
    /// Tool keys (`toolCall.kind`, else its title) a person approved for good.
    pub approved_tools: Vec<String>,
    /// Set once any request had to be refused, so the run can report that it
    /// was blocked rather than claim it finished its job.
    pub blocked: Arc<AtomicBool>,
}

impl UnattendedApprovals {
    /// Pick the option to answer `params` with: an allow-once when the tool is
    /// approved, otherwise a reject-once (or a cancel when none is offered).
    fn answer(&self, params: &Value) -> Value {
        let tool = params.get("toolCall");
        let key = tool
            .and_then(|t| t.get("kind"))
            .and_then(Value::as_str)
            .or_else(|| tool.and_then(|t| t.get("title")).and_then(Value::as_str))
            .unwrap_or_default();
        let allowed = self.allow_all || self.approved_tools.iter().any(|t| t == key);
        if !allowed {
            self.blocked.store(true, Ordering::Relaxed);
        }
        let wanted = if allowed { "allow_once" } else { "reject_once" };
        let option = params
            .get("options")
            .and_then(Value::as_array)
            .and_then(|options| {
                options
                    .iter()
                    .find(|o| o.get("kind").and_then(Value::as_str) == Some(wanted))
            })
            .and_then(|o| o.get("optionId"))
            .cloned();
        match option {
            Some(id) => json!({ "outcome": { "outcome": "selected", "optionId": id } }),
            None => json!({ "outcome": { "outcome": "cancelled" } }),
        }
    }
}

type Pending = Arc<DashMap<i64, oneshot::Sender<Result<Value, String>>>>;

impl Drop for AcpClient {
    fn drop(&mut self) {
        self.revoke_delegation();
    }
}

pub struct AcpClient {
    pub connection_id: String,
    pub agent_id: String,
    /// Display name of the agent, stored alongside persisted sessions.
    pub agent_name: String,
    /// The bot this process was started for, when it was started from the Bot
    /// tab. Every session it opens is tagged with it, which is what keeps a
    /// bot's conversations out of the per-project session lists.
    pub bot_id: Option<String>,
    policy: ConnectionPolicy,
    delegation_tokens: DashMap<String, ()>,
    /// Sessions opened on this connection, keyed by ACP session id. One agent
    /// process can host several sessions at once.
    sessions: Arc<DashMap<String, ()>>,
    /// Most recently opened session, used when a call omits the session id.
    last_session: Mutex<Option<String>>,
    /// Sessions whose stored transcript `session/load` is replaying right now,
    /// so the replayed updates are not persisted again.
    replaying: Arc<DashMap<String, ()>>,
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    next_id: AtomicI64,
    pending: Pending,
    /// JSON-RPC id of an in-flight `session/request_permission`, keyed by the
    /// request id we hand to the frontend.
    pending_permissions: Arc<DashMap<String, oneshot::Sender<Value>>>,
    sink: Arc<dyn EventSink>,
}

impl AcpClient {
    /// Spawn the agent process and run the ACP handshake (`initialize`).
    /// Does not create a session yet — see [`AcpClient::new_session`].
    pub async fn spawn(
        connection_id: String,
        agent: &AcpAgentDef,
        cwd: Option<&str>,
        bot_id: Option<String>,
        policy: ConnectionPolicy,
        sink: Arc<dyn EventSink>,
    ) -> Result<(Arc<Self>, Value), String> {
        let mut cmd = Command::new(&agent.command);
        cmd.args(&agent.args);
        if policy.strict_mcp {
            // Appended to the resolved launcher: bundled, PATH and npx all
            // receive the same agent option. Older agents must fail closed.
            cmd.args(["--mcp-policy", "client-only"]);
        }
        cmd.envs(&agent.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }

        let mut child = cmd.spawn().map_err(|e| {
            policy.revoke_delegation();
            format!("failed to spawn `{}`: {e}", agent.command)
        })?;
        let stdin = child.stdin.take().ok_or("failed to open agent stdin")?;
        let stdout = child.stdout.take().ok_or("failed to open agent stdout")?;
        let stderr = child.stderr.take().ok_or("failed to open agent stderr")?;

        let client = Arc::new(Self {
            connection_id: connection_id.clone(),
            agent_id: agent.id.clone(),
            agent_name: agent.name.clone(),
            bot_id,
            policy,
            delegation_tokens: DashMap::new(),
            sessions: Arc::new(DashMap::new()),
            last_session: Mutex::new(None),
            replaying: Arc::new(DashMap::new()),
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            next_id: AtomicI64::new(1),
            pending: Arc::new(DashMap::new()),
            pending_permissions: Arc::new(DashMap::new()),
            sink,
        });

        // stdout: JSON-RPC frames, one per line.
        {
            let client = client.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if line.trim().is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<Value>(&line) {
                        Ok(msg) => client.handle_incoming(msg).await,
                        Err(e) => log::warn!("acp: bad frame from agent: {e}: {line}"),
                    }
                }
                client.revoke_delegation();
                client.emit(json!({ "kind": "exited" }));
                // Fail every request still waiting on a reply.
                let ids: Vec<i64> = client.pending.iter().map(|e| *e.key()).collect();
                for id in ids {
                    if let Some((_, tx)) = client.pending.remove(&id) {
                        let _ = tx.send(Err("agent exited".to_string()));
                    }
                }
            });
        }

        // stderr: surfaced to the UI as log lines.
        {
            let client = client.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    // debug! is silent in a release build's log file, which is
                    // exactly where an agent's own crash reason is needed most.
                    log::info!("acp stderr: {line}");
                    client.emit(json!({ "kind": "stderr", "line": line }));
                }
            });
        }

        let initialize = client.request(
            "initialize",
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "clientCapabilities": {
                    "fs": { "readTextFile": true, "writeTextFile": true },
                    "terminal": false
                },
                "clientInfo": { "name": "codexia", "version": env!("CARGO_PKG_VERSION") }
            }),
        );
        let init = if client.policy.strict_mcp {
            tokio::time::timeout(std::time::Duration::from_secs(120), initialize)
                .await
                .unwrap_or_else(|_| Err("ACP initialize timed out".into()))
        } else {
            initialize.await
        };
        let init = init.and_then(|init| {
            validate_mcp_policy(&client.policy, &init)?;
            Ok(init)
        });
        let init = match init {
            Ok(init) => init,
            Err(error) => {
                client.kill().await;
                return Err(if client.policy.strict_mcp {
                    format!("Bot requires keke strict MCP isolation (--mcp-policy client-only): {error}. Use a runtime that confirms the active policy during ACP initialize.")
                } else { error });
            }
        };

        Ok((client, init))
    }

    /// Returns the full `session/new` result: besides `sessionId` it carries
    /// `modes`, `models` and `configOptions`, which drive the session controls.
    pub async fn new_session(&self, cwd: &str) -> Result<Value, String> {
        let servers = self.session_mcp_servers();
        let res = self
            .request(
                "session/new",
                json!({ "cwd": cwd, "mcpServers": servers }),
            )
            .await?;
        let session_id = res
            .get("sessionId")
            .and_then(Value::as_str)
            .ok_or("session/new returned no sessionId")?
            .to_string();
        self.track_session(session_id.clone()).await;
        if let Err(e) = codexia_db::acp_sessions::upsert_session(
            &session_id,
            &self.agent_id,
            Some(&self.agent_name),
            cwd,
            self.bot_id.as_deref(),
        ) {
            log::warn!("acp: failed to record session: {e}");
        }
        Ok(res)
    }

    /// Resume a previous session. Only agents whose `initialize` result sets
    /// `agentCapabilities.loadSession` support this; the others must be given
    /// the stored transcript as read-only history instead.
    pub async fn load_session(&self, session_id: &str, cwd: &str) -> Result<Value, String> {
        let servers = self.session_mcp_servers();
        // The replay arrives as ordinary `session/update` notifications, which
        // are already stored — don't write them a second time.
        self.replaying.insert(session_id.to_string(), ());
        let res = self
            .request(
                "session/load",
                json!({ "sessionId": session_id, "cwd": cwd, "mcpServers": servers }),
            )
            .await;
        self.replaying.remove(session_id);
        let res = res?;
        self.track_session(session_id.to_string()).await;
        if let Err(e) = codexia_db::acp_sessions::upsert_session(
            session_id,
            &self.agent_id,
            Some(&self.agent_name),
            cwd,
            self.bot_id.as_deref(),
        ) {
            log::warn!("acp: failed to record session: {e}");
        }
        Ok(res)
    }

    /// Remember a session and make it the default for calls that omit an id.
    async fn track_session(&self, session_id: String) {
        self.sessions.insert(session_id.clone(), ());
        *self.last_session.lock().await = Some(session_id);
    }

    /// Resolve the session a call targets: the given id when it belongs to this
    /// connection, otherwise the most recently opened one.
    pub async fn resolve_session(&self, session_id: Option<&str>) -> Result<String, String> {
        match session_id {
            Some(id) if self.sessions.contains_key(id) => Ok(id.to_string()),
            Some(id) => Err(format!("unknown ACP session: {id}")),
            None => self
                .last_session
                .lock()
                .await
                .clone()
                .ok_or_else(|| "no active ACP session".to_string()),
        }
    }

    pub async fn set_mode(&self, session_id: Option<&str>, mode_id: &str) -> Result<Value, String> {
        self.session_request(session_id, "session/set_mode", json!({ "modeId": mode_id }))
            .await
    }

    /// `reasoning_effort` rides along in `_meta`: agents that advertise
    /// per-model efforts (Grok) read it there, others ignore it.
    pub async fn set_model(
        &self,
        session_id: Option<&str>,
        model_id: &str,
        reasoning_effort: Option<&str>,
    ) -> Result<Value, String> {
        let mut params = json!({ "modelId": model_id });
        if let Some(effort) = reasoning_effort {
            params["_meta"] = json!({ "reasoningEffort": effort });
        }
        self.session_request(session_id, "session/set_model", params)
            .await
    }

    /// Set one of the agent's advertised `configOptions` (mode, model,
    /// reasoning effort, ...). `value` is a bool for toggles, otherwise the
    /// selected value id.
    pub async fn set_config_option(
        &self,
        session_id: Option<&str>,
        config_id: &str,
        value: &Value,
    ) -> Result<Value, String> {
        // The value object is flattened into the request per the ACP schema:
        // `{"type":"boolean","value":true}` for toggles, `{"value":"id"}` for selects.
        let mut params = json!({ "configId": config_id });
        let obj = params.as_object_mut().expect("object");
        match value {
            Value::Bool(b) => {
                obj.insert("type".into(), json!("boolean"));
                obj.insert("value".into(), json!(b));
            }
            other => {
                obj.insert("value".into(), other.clone());
            }
        }
        self.session_request(session_id, "session/set_config_option", params)
            .await
    }

    /// Issue a request that needs a `sessionId` injected.
    async fn session_request(
        &self,
        session_id: Option<&str>,
        method: &str,
        mut params: Value,
    ) -> Result<Value, String> {
        let session_id = self.resolve_session(session_id).await?;
        if let Some(obj) = params.as_object_mut() {
            obj.insert("sessionId".into(), json!(session_id));
        }
        self.request(method, params).await
    }

    pub async fn authenticate(&self, method_id: &str) -> Result<(), String> {
        self.request(
            "authenticate",
            json!({ "methodId": method_id, "_meta": { "persist": false } }),
        )
        .await
        .map(|_| ())
    }

    /// Send a user turn. Resolves when the agent finishes the turn; streamed
    /// output arrives meanwhile as `session/update` events.
    pub async fn prompt(&self, session_id: Option<&str>, text: &str) -> Result<Value, String> {
        let session_id = self.resolve_session(session_id).await?;
        // The agent never echoes the user's turn back, so record it here to
        // keep the persisted transcript complete.
        self.persist(
            &session_id,
            &json!({
                "sessionUpdate": "user_message_chunk",
                "content": { "type": "text", "text": text }
            }),
        );
        if let Err(e) = codexia_db::acp_sessions::set_title_if_empty(&session_id, text) {
            log::warn!("acp: failed to set session title: {e}");
        }
        self.session_request(
            Some(&session_id),
            "session/prompt",
            json!({ "prompt": [{ "type": "text", "text": text }] }),
        )
        .await
    }

    pub async fn cancel(&self, session_id: Option<&str>) -> Result<(), String> {
        let Ok(session_id) = self.resolve_session(session_id).await else {
            return Ok(());
        };
        self.notify("session/cancel", json!({ "sessionId": session_id }))
            .await
    }

    /// Answer a `session/request_permission` the agent is blocked on.
    /// `option_id == None` means the user dismissed the request.
    pub fn respond_permission(&self, request_id: &str, option_id: Option<String>) -> Result<(), String> {
        let (_, tx) = self
            .pending_permissions
            .remove(request_id)
            .ok_or_else(|| format!("unknown permission request: {request_id}"))?;
        let outcome = match option_id {
            Some(id) => json!({ "outcome": "selected", "optionId": id }),
            None => json!({ "outcome": "cancelled" }),
        };
        let _ = tx.send(json!({ "outcome": outcome }));
        Ok(())
    }

    pub async fn kill(&self) {
        self.revoke_delegation();
        let _ = self.child.lock().await.kill().await;
    }

    fn session_mcp_servers(&self) -> Vec<Value> {
        let mut servers = self.policy.mcp_servers.clone();
        for server in &mut servers {
            if server["name"] != "codexia-bots" {
                continue;
            }
            let Some(caller) = self.bot_id.as_deref() else { continue };
            let Some(headers) = server["headers"].as_array_mut() else { continue };
            for header in headers {
                if header["name"] == "X-Codexia-Delegation" {
                    let template = header["value"].as_str().unwrap_or_default();
                    if crate::delegation::verify(template, caller) {
                        let token = crate::delegation::issue(caller);
                        self.delegation_tokens.insert(token.clone(), ());
                        header["value"] = json!(token);
                    }
                }
            }
        }
        servers
    }

    fn revoke_delegation(&self) {
        for token in &self.delegation_tokens {
            crate::delegation::revoke(token.key());
        }
        self.policy.revoke_delegation();
    }

    // --- JSON-RPC plumbing ---

    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.insert(id, tx);
        if let Err(e) = self
            .write(json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }))
            .await
        {
            self.pending.remove(&id);
            return Err(e);
        }
        rx.await.map_err(|_| "agent connection closed".to_string())?
    }

    async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        self.write(json!({ "jsonrpc": "2.0", "method": method, "params": params }))
            .await
    }

    async fn write(&self, msg: Value) -> Result<(), String> {
        let mut line = msg.to_string();
        line.push('\n');
        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        stdin.flush().await.map_err(|e| e.to_string())
    }

    /// Append a `session/update` payload to the stored transcript. Storage is
    /// best effort: a failure here must not break the live session.
    fn persist(&self, session_id: &str, update: &Value) {
        if self.replaying.contains_key(session_id) {
            return;
        }
        if let Err(e) = codexia_db::acp_sessions::append_update(session_id, &update.to_string()) {
            log::warn!("acp: failed to persist session update: {e}");
        }
    }

    fn emit(&self, mut payload: Value) {
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("connectionId".into(), json!(self.connection_id));
            obj.insert("agentId".into(), json!(self.agent_id));
        }
        self.sink.emit(ACP_EVENT, payload);
    }

    async fn handle_incoming(self: &Arc<Self>, msg: Value) {
        let method = msg.get("method").and_then(Value::as_str);
        let id = msg.get("id").cloned();

        match (method, id) {
            // Response to one of our requests.
            (None, Some(id)) => {
                let Some(id) = id.as_i64() else { return };
                let Some((_, tx)) = self.pending.remove(&id) else {
                    return;
                };
                let result = if let Some(err) = msg.get("error") {
                    let message = err
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("agent error");
                    // Agents put the actionable reason behind a generic
                    // "Internal error" message, either as `data.details` or,
                    // as keke does, as `data` itself being the reason string.
                    let details = err.get("data").and_then(|d| {
                        d.get("details")
                            .and_then(Value::as_str)
                            .or_else(|| d.as_str())
                    });
                    Err(match details {
                        Some(details) => format!("{message}: {details}"),
                        None => message.to_string(),
                    })
                } else {
                    Ok(msg.get("result").cloned().unwrap_or(Value::Null))
                };
                let _ = tx.send(result);
            }
            // Notification from the agent.
            (Some(method), None) => {
                let params = msg.get("params").cloned().unwrap_or(Value::Null);
                if method == "session/update" {
                    if let (Some(session_id), Some(update)) = (
                        params.get("sessionId").and_then(Value::as_str),
                        params.get("update"),
                    ) {
                        self.persist(session_id, update);
                    }
                    self.emit(json!({
                        "kind": "update",
                        "sessionId": params.get("sessionId"),
                        "update": params.get("update"),
                    }));
                } else {
                    self.emit(json!({ "kind": "notification", "method": method, "params": params }));
                }
            }
            // Request from the agent — must be answered.
            (Some(method), Some(id)) => {
                let params = msg.get("params").cloned().unwrap_or(Value::Null);
                let this = self.clone();
                let method = method.to_string();
                tokio::spawn(async move {
                    match this.handle_request(&method, params, &id).await {
                        Ok(Some(result)) => {
                            let _ = this
                                .write(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
                                .await;
                        }
                        // Answered asynchronously (permission prompts).
                        Ok(None) => {}
                        Err(message) => {
                            let _ = this
                                .write(json!({
                                    "jsonrpc": "2.0",
                                    "id": id,
                                    "error": { "code": -32603, "message": message }
                                }))
                                .await;
                        }
                    }
                });
            }
            (None, None) => {}
        }
    }

    /// `Ok(None)` means the reply will be written later by another task.
    async fn handle_request(
        self: &Arc<Self>,
        method: &str,
        params: Value,
        id: &Value,
    ) -> Result<Option<Value>, String> {
        match method {
            "fs/read_text_file" => {
                let path = params
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or("fs/read_text_file: missing path")?;
                let content = tokio::fs::read_to_string(path)
                    .await
                    .map_err(|e| format!("{path}: {e}"))?;
                // Optional windowing, 1-based line numbers per the spec.
                let line = params.get("line").and_then(Value::as_u64);
                let limit = params.get("limit").and_then(Value::as_u64);
                let content = if line.is_some() || limit.is_some() {
                    let start = line.unwrap_or(1).saturating_sub(1) as usize;
                    let lines: Vec<&str> = content.lines().skip(start).collect();
                    let lines = match limit {
                        Some(n) => lines.into_iter().take(n as usize).collect::<Vec<_>>(),
                        None => lines,
                    };
                    lines.join("\n")
                } else {
                    content
                };
                Ok(Some(json!({ "content": content })))
            }
            "fs/write_text_file" => {
                if self.policy.read_only {
                    return Err("this agent is read-only: writing files is not allowed".to_string());
                }
                let path = params
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or("fs/write_text_file: missing path")?;
                let content = params
                    .get("content")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if let Some(parent) = std::path::Path::new(path).parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }
                tokio::fs::write(path, content)
                    .await
                    .map_err(|e| format!("{path}: {e}"))?;
                Ok(Some(Value::Null))
            }
            "session/request_permission" => {
                if let Some(unattended) = &self.policy.unattended {
                    return Ok(Some(unattended.answer(&params)));
                }
                let request_id = format!("{}-{}", self.connection_id, id);
                let (tx, rx) = oneshot::channel();
                self.pending_permissions.insert(request_id.clone(), tx);
                self.emit(json!({
                    "kind": "permission",
                    "requestId": request_id,
                    "sessionId": params.get("sessionId"),
                    "toolCall": params.get("toolCall"),
                    "options": params.get("options"),
                }));

                let this = self.clone();
                let id = id.clone();
                tokio::spawn(async move {
                    let result = rx
                        .await
                        .unwrap_or_else(|_| json!({ "outcome": { "outcome": "cancelled" } }));
                    let _ = this
                        .write(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
                        .await;
                });
                Ok(None)
            }
            other => Err(format!("unsupported client method: {other}")),
        }
    }
}

fn validate_mcp_policy(policy: &ConnectionPolicy, init: &Value) -> Result<(), String> {
    if policy.strict_mcp
        && init.get("_meta").and_then(|meta| meta.get("keke.dev/mcp-policy"))
            .and_then(Value::as_str) != Some("client-only")
    {
        return Err("runtime did not confirm client-only MCP policy; refusing to open a Bot session".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct QuietSink;
    impl EventSink for QuietSink {
        fn emit(&self, _: &str, _: Value) {}
    }

    #[test]
    fn strict_policy_requires_active_confirmation_not_version_or_support_claim() {
        let strict = ConnectionPolicy { strict_mcp: true, ..Default::default() };
        for init in [json!({}), json!({"agentInfo":{"version":"999.0"}}),
            json!({"_meta":{"keke.dev/mcp-policy":"merge"}}),
            json!({"_meta":{"keke.dev/mcp-policy":true}})] {
            assert!(validate_mcp_policy(&strict, &init).is_err());
            assert!(validate_mcp_policy(&ConnectionPolicy::default(), &init).is_ok());
        }
        assert!(validate_mcp_policy(&strict,
            &json!({"_meta":{"keke.dev/mcp-policy":"client-only"}})).is_ok());
    }

    // The fixture only speaks ACP and inspects launcher arguments. No real
    // agent, credentials, MCP server or database is touched by these tests.
    #[cfg(unix)]
    async fn fixture(policy: ConnectionPolicy, advertised: &str) -> Result<(Arc<AcpClient>, Value), String> {
        let agent = AcpAgentDef {
            id: "fixture".into(), name: "Fixture".into(), command: "python3".into(),
            args: vec!["-u".into(), "-c".into(), r#"
import json, os, sys
for line in sys.stdin:
    msg = json.loads(line)
    if msg['method'] == 'initialize':
        result = {'arguments': sys.argv[1:]}
        if os.environ['POLICY'] != 'absent':
            result['_meta'] = {'keke.dev/mcp-policy': os.environ['POLICY']}
        reply = {'result': result}
    else:
        reply = {'error': {'code': -32603, 'message': json.dumps(msg['params'])}}
    print(json.dumps(dict(jsonrpc='2.0', id=msg['id'], **reply)), flush=True)
"#.into()],
            env: [("POLICY".into(), advertised.into())].into(),
            available: true, local: true,
        };
        AcpClient::spawn("fixture".into(), &agent, None, Some("caller".into()), policy, Arc::new(QuietSink)).await
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn older_and_nonisolating_runtimes_fail_before_bot_session_creation() {
        for advertised in ["absent", "merge"] {
            let template = crate::delegation::issue("caller");
            let policy = ConnectionPolicy { strict_mcp: true, mcp_servers: vec![json!({
                "name":"codexia-bots", "headers":[{"name":"X-Codexia-Delegation","value":template}]
            })], ..Default::default() };
            let error = match fixture(policy, advertised).await {
                Ok((client, _)) => { client.kill().await; panic!("unsafe runtime accepted"); }
                Err(error) => error,
            };
            assert!(error.contains("Bot requires keke strict MCP isolation"));
            assert!(!crate::delegation::verify(&template, "caller"));
        }
        let (client, init) = fixture(ConnectionPolicy::default(), "absent").await.unwrap();
        assert_eq!(init["arguments"], json!([]));
        client.kill().await;
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn strict_new_and_load_forward_identical_original_names_and_headers() {
        let servers = vec![json!({"name":"native", "type":"sse", "url":"https://example.test/mcp",
            "headers":[{"name":"X-Test","value":"${TEST_HEADER}"}]})];
        let policy = ConnectionPolicy { strict_mcp: true, mcp_servers: servers.clone(), ..Default::default() };
        let (client, init) = fixture(policy, "client-only").await.unwrap();
        assert_eq!(init["arguments"], json!(["--mcp-policy", "client-only"]));
        let new: Value = serde_json::from_str(&client.new_session("/tmp").await.unwrap_err()).unwrap();
        let load: Value = serde_json::from_str(&client.load_session("stored", "/tmp").await.unwrap_err()).unwrap();
        assert_eq!(new["mcpServers"], json!(servers));
        assert_eq!(new["mcpServers"], load["mcpServers"]);
        client.kill().await;
        let (client, _) = fixture(ConnectionPolicy { strict_mcp: true, ..Default::default() }, "client-only").await.unwrap();
        let new: Value = serde_json::from_str(&client.new_session("/tmp").await.unwrap_err()).unwrap();
        assert_eq!(new["mcpServers"], json!([]));
        client.kill().await;
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn strict_sessions_bind_rotate_and_revoke_collaboration_capabilities() {
        let template = crate::delegation::issue("caller");
        let policy = ConnectionPolicy { strict_mcp: true, mcp_servers: vec![json!({
            "name":"codexia-bots", "type":"http", "url":"http://127.0.0.1/mcp/bots?from=caller",
            "headers":[{"name":"X-Codexia-Delegation","value":template}]
        })], ..Default::default() };
        let (client, _) = fixture(policy, "client-only").await.unwrap();
        let new: Value = serde_json::from_str(&client.new_session("/tmp").await.unwrap_err()).unwrap();
        let load: Value = serde_json::from_str(&client.load_session("stored", "/tmp").await.unwrap_err()).unwrap();
        let first = new["mcpServers"][0]["headers"][0]["value"].as_str().unwrap();
        let second = load["mcpServers"][0]["headers"][0]["value"].as_str().unwrap();
        assert_ne!(first, second);
        assert_ne!(first, template);
        assert!(crate::delegation::verify(first, "caller"));
        assert!(!crate::delegation::verify(first, "other"));
        client.kill().await;
        for token in [first, second, template.as_str()] {
            assert!(!crate::delegation::verify(token, "caller"));
        }
    }

    fn request(kind: &str) -> Value {
        json!({
            "toolCall": { "kind": kind, "title": "Run a command" },
            "options": [
                { "optionId": "allow", "kind": "allow_once" },
                { "optionId": "deny", "kind": "reject_once" },
            ],
        })
    }

    fn picked(answer: &Value) -> Option<&str> {
        answer["outcome"]["optionId"].as_str()
    }

    #[test]
    fn unattended_allows_approved_tools_only() {
        let approvals = UnattendedApprovals {
            approved_tools: vec!["read".into()],
            ..Default::default()
        };
        assert_eq!(picked(&approvals.answer(&request("read"))), Some("allow"));
        assert!(!approvals.blocked.load(Ordering::Relaxed));

        assert_eq!(picked(&approvals.answer(&request("execute"))), Some("deny"));
        assert!(approvals.blocked.load(Ordering::Relaxed));
    }

    #[test]
    fn unattended_allow_all_never_blocks() {
        let approvals = UnattendedApprovals { allow_all: true, ..Default::default() };
        assert_eq!(picked(&approvals.answer(&request("execute"))), Some("allow"));
        assert!(!approvals.blocked.load(Ordering::Relaxed));
    }

    #[test]
    fn unattended_cancels_when_no_reject_option() {
        let approvals = UnattendedApprovals::default();
        let answer = approvals.answer(&json!({ "toolCall": { "title": "x" }, "options": [] }));
        assert_eq!(answer["outcome"]["outcome"], "cancelled");
    }
}
