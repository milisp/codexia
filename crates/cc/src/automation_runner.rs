//! Drives a Claude Code session on behalf of `codexia-automation`.

use async_trait::async_trait;
use claude_agent_sdk_rs::Message;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use codexia_shared::agent_runner::{AgentRunOutcome, AgentRunSpec, AgentRunner};

use crate::services::{message_service, session_service};
use crate::{CCConnectParams, CCState};

pub struct CcAgentRunner {
    cc_state: CCState,
}

impl CcAgentRunner {
    pub fn new(cc_state: CCState) -> Self {
        Self { cc_state }
    }
}

#[async_trait]
impl AgentRunner for CcAgentRunner {
    fn agent(&self) -> &'static str {
        "cc"
    }

    async fn start_run(&self, spec: AgentRunSpec) -> Result<AgentRunOutcome, String> {
        let session_id = Uuid::new_v4().to_string();
        let target_dir = match spec.cwd.as_ref() {
            Some(cwd) => cwd.clone(),
            None => std::env::current_dir()
                .map_err(|err| err.to_string())?
                .to_string_lossy()
                .to_string(),
        };

        session_service::connect(
            CCConnectParams {
                session_id: session_id.clone(),
                cwd: target_dir,
                model: if spec.model.trim().is_empty() {
                    None
                } else {
                    Some(spec.model.clone())
                },
                effort: None,
                permission_mode: Some("bypassPermissions".to_string()),
                resume_id: None,
            },
            &self.cc_state,
        )
        .await?;
        log::info!("[CC automation] Connected to Claude session {}", session_id);

        // `session_id` is only our local client key; the run must be recorded under the
        // real CLI session id, which arrives with the first system message.
        let real_session_id: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
        let on_message = {
            let real_session_id = Arc::clone(&real_session_id);
            let on_started = Arc::clone(&spec.on_started);
            let client_key = session_id.clone();
            let cc_state = self.cc_state.clone();
            move |message: Message| {
                let id = match &message {
                    Message::System(system) => system.session_id.clone(),
                    Message::Result(result) => Some(result.session_id.clone()),
                    _ => None,
                };
                let Some(id) = id else { return };
                {
                    let mut slot = real_session_id.lock().unwrap();
                    if slot.is_some() {
                        return;
                    }
                    *slot = Some(id.clone());
                }
                log::info!(
                    "[CC automation] Session {} reported CLI session id {}",
                    client_key,
                    id
                );
                // Reachable under the real id too, so the UI can interrupt the run.
                let cc_state = cc_state.clone();
                let client_key = client_key.clone();
                let alias = id.clone();
                tokio::spawn(async move {
                    cc_state.alias_client(client_key.as_str(), alias).await;
                });
                on_started(id.as_str());
            }
        };

        log::info!("[CC automation] Sending prompt to session {}...", session_id);
        let result = message_service::send_message_and_wait(
            session_id.as_str(),
            spec.prompt.as_str(),
            &[],
            &self.cc_state,
            on_message,
        )
        .await;

        let alias = real_session_id.lock().unwrap().clone();
        if let Some(alias) = alias {
            if alias != session_id {
                if let Err(err) = session_service::disconnect(alias.as_str(), &self.cc_state).await {
                    log::warn!(
                        "failed to disconnect cc session {} for automation '{}': {}",
                        alias,
                        spec.task_id,
                        err
                    );
                }
            }
        }

        if let Err(err) = session_service::disconnect(session_id.as_str(), &self.cc_state).await {
            log::warn!(
                "failed to disconnect cc session {} for automation '{}': {}",
                session_id,
                spec.task_id,
                err
            );
        }

        result.map(|_| AgentRunOutcome::Finished)
    }
}
