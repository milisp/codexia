//! Drives a codex thread on behalf of `codexia-automation`.

use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::Mutex;

use codexia_shared::agent_runner::{AgentRunOutcome, AgentRunSpec, AgentRunner};

use crate::app_server::CodexAppServer;

fn sandbox_policy_workspace_write() -> Value {
    json!({
        "type": "workspaceWrite",
        "writableRoots": [],
        "readOnlyAccess": {
            "type": "fullAccess"
        },
        "networkAccess": false,
        "excludeTmpdirEnvVar": false,
        "excludeSlashTmp": false
    })
}

/// Holds the app-server slot rather than a client, because codex connects
/// asynchronously and may not be up when automation starts.
pub struct CodexAgentRunner {
    client: Arc<Mutex<Option<Arc<CodexAppServer>>>>,
}

impl CodexAgentRunner {
    pub fn new(client: Option<Arc<CodexAppServer>>) -> Self {
        Self {
            client: Arc::new(Mutex::new(client)),
        }
    }

    /// Rebinds the runner once the app-server finishes connecting.
    pub async fn set_client(&self, client: Arc<CodexAppServer>) {
        *self.client.lock().await = Some(client);
    }
}

#[async_trait]
impl AgentRunner for CodexAgentRunner {
    fn agent(&self) -> &'static str {
        "codex"
    }

    async fn start_run(&self, spec: AgentRunSpec) -> Result<AgentRunOutcome, String> {
        let codex = {
            let guard = self.client.lock().await;
            guard.clone()
        }
        .ok_or_else(|| "codex app-server is not available".to_string())?;

        let mut start_params_map = serde_json::Map::new();
        start_params_map.insert("model".to_string(), json!(spec.model));
        start_params_map.insert("modelProvider".to_string(), json!(spec.model_provider));
        start_params_map.insert("approvalPolicy".to_string(), json!("on-request"));
        start_params_map.insert("sandbox".to_string(), json!("workspace-write"));
        start_params_map.insert(
            "config".to_string(),
            json!({
                "model_reasoning_effort": "medium",
                "show_raw_agent_reasoning": true,
                "model_reasoning_summary": "auto",
                "web_search_request": false,
                "view_image_tool": true,
                "features.multi_agents": true
            }),
        );
        start_params_map.insert("personality".to_string(), json!("friendly"));
        start_params_map.insert("experimentalRawEvents".to_string(), json!(true));
        if let Some(cwd) = spec.cwd.as_ref() {
            start_params_map.insert("cwd".to_string(), json!(cwd));
        }
        let thread_result = codex
            .send_request("thread/start", Value::Object(start_params_map))
            .await?;
        let thread_id = thread_result
            .get("thread")
            .and_then(|thread| thread.get("id"))
            .and_then(Value::as_str)
            .ok_or_else(|| "thread/start response missing thread.id".to_string())?;

        (spec.on_started)(thread_id);

        let mut turn_params_map = serde_json::Map::new();
        turn_params_map.insert("threadId".to_string(), json!(thread_id));
        turn_params_map.insert("model".to_string(), json!(spec.model));
        turn_params_map.insert(
            "input".to_string(),
            json!([
                {
                    "type": "text",
                    "text": spec.prompt,
                    "text_elements": []
                }
            ]),
        );
        turn_params_map.insert("approvalPolicy".to_string(), json!("on-request"));
        turn_params_map.insert("sandboxPolicy".to_string(), sandbox_policy_workspace_write());
        turn_params_map.insert("effort".to_string(), json!("medium"));
        turn_params_map.insert("personality".to_string(), json!("friendly"));
        turn_params_map.insert(
            "collaborationMode".to_string(),
            json!({
                "mode": "default",
                "settings": {
                    "model": spec.model,
                    "reasoning_effort": "medium"
                }
            }),
        );
        if let Some(cwd) = spec.cwd.as_ref() {
            turn_params_map.insert("cwd".to_string(), json!(cwd));
        }
        codex
            .send_request("turn/start", Value::Object(turn_params_map))
            .await?;

        // The turn completes asynchronously; `app_server` syncs the final status from
        // the raw event stream.
        Ok(AgentRunOutcome::Detached)
    }
}
