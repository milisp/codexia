use chrono::Utc;
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::cc::services::{message_service, session_service};
use crate::cc::{CCState, CCConnectParams};
use crate::codex::CodexAppServer;
use crate::db::automation_runs;
use crate::features::event_sink::EventSink;

use super::model::{AutomationTask, default_model, default_model_provider, normalize_model_provider};

pub(crate) fn sync_automation_run_status(payload: &Value) {
    let method = payload.get("method").and_then(Value::as_str);
    match method {
        Some("turn/completed") => {
            let status = payload
                .get("params")
                .and_then(|p| p.get("turn"))
                .and_then(|t| t.get("status"))
                .and_then(Value::as_str)
                .unwrap_or("completed");
            let mapped_status = if status.eq_ignore_ascii_case("completed") {
                "completed"
            } else {
                "failed"
            };
            if let Some(thread_id) = payload
                .get("params")
                .and_then(|p| p.get("threadId"))
                .and_then(Value::as_str)
            {
                if let Err(err) = automation_runs::mark_run_status_by_thread(thread_id, mapped_status) {
                    log::warn!(
                        "failed to sync automation run status from codex turn/completed for thread {}: {}",
                        thread_id,
                        err
                    );
                }
            }
        }
        Some("error") => {
            if let Some(thread_id) = payload
                .get("params")
                .and_then(|p| p.get("threadId"))
                .and_then(Value::as_str)
            {
                if let Err(err) = automation_runs::mark_run_status_by_thread(thread_id, "failed") {
                    log::warn!(
                        "failed to sync automation run status from codex error for thread {}: {}",
                        thread_id,
                        err
                    );
                }
            }
        }
        _ => {}
    }
}

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

async fn run_task_with_codex(
    codex: Arc<CodexAppServer>,
    task: AutomationTask,
    event_sink: Arc<dyn EventSink>,
) -> Result<(), String> {
    let model_provider = normalize_model_provider(Some(task.model_provider.clone()))
        .unwrap_or_else(|_| default_model_provider());
    let model = if task.model.trim().is_empty() {
        default_model()
    } else {
        task.model.clone()
    };
    let targets = if task.projects.is_empty() {
        vec![None]
    } else {
        task.projects
            .iter()
            .map(|project| Some(project.clone()))
            .collect::<Vec<Option<String>>>()
    };

    for target_cwd in targets {
        let mut start_params_map = serde_json::Map::new();
        start_params_map.insert("model".to_string(), json!(model.clone()));
        start_params_map.insert("modelProvider".to_string(), json!(model_provider.clone()));
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
        if let Some(cwd) = target_cwd.as_ref() {
            start_params_map.insert("cwd".to_string(), json!(cwd));
        }
        let start_params = Value::Object(start_params_map);
        let thread_result = codex.send_request("thread/start", start_params).await?;
        let thread_id = thread_result
            .get("thread")
            .and_then(|thread| thread.get("id"))
            .and_then(Value::as_str)
            .ok_or_else(|| "thread/start response missing thread.id".to_string())?;

        event_sink.emit(
            "automation:run/started",
            json!({
                "taskId": task.id,
                "taskName": task.name,
                "threadId": thread_id,
                "startedAt": Utc::now().to_rfc3339(),
            }),
        );
        let _ = automation_runs::insert_run_started(
            task.id.as_str(),
            task.name.as_str(),
            thread_id,
            Utc::now().to_rfc3339().as_str(),
        )
        .map_err(|err| {
            log::warn!("failed to persist automation run started for '{}': {}", task.id, err);
            err
        });

        let mut turn_params_map = serde_json::Map::new();
        turn_params_map.insert("threadId".to_string(), json!(thread_id));
        turn_params_map.insert("model".to_string(), json!(model.clone()));
        turn_params_map.insert(
            "input".to_string(),
            json!([
                {
                    "type": "text",
                    "text": task.prompt,
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
                    "model": model.clone(),
                    "reasoning_effort": "medium"
                }
            }),
        );
        if let Some(cwd) = target_cwd.as_ref() {
            turn_params_map.insert("cwd".to_string(), json!(cwd));
        }
        let turn_params = Value::Object(turn_params_map);
        if let Err(err) = codex.send_request("turn/start", turn_params).await {
            let _ = automation_runs::mark_run_status_by_thread(thread_id, "failed").map_err(|db_err| {
                log::warn!("failed to mark automation run failed for '{}': {}", task.id, db_err);
                db_err
            });
            return Err(err);
        }
    }

    Ok(())
}

async fn run_task_with_cc(
    task: AutomationTask,
    cc_state: CCState,
) -> Result<(), String> {
    let targets = if task.projects.is_empty() {
        vec![None]
    } else {
        task.projects
            .iter()
            .map(|project| Some(project.clone()))
            .collect::<Vec<Option<String>>>()
    };

    for target_cwd in targets {
        let session_id = Uuid::new_v4().to_string();
        let target_dir = if let Some(cwd) = target_cwd {
            cwd
        } else {
            std::env::current_dir()
                .map_err(|err| err.to_string())?
                .to_string_lossy()
                .to_string()
        };
        session_service::connect(
            CCConnectParams {
                session_id: session_id.clone(),
                cwd: target_dir,
                model: if task.model.trim().is_empty() {
                    None
                } else {
                    Some(task.model.clone())
                },
                permission_mode: None,
                resume_id: None,
            },
            &cc_state,
        )
        .await?;

        let started_at = Utc::now().to_rfc3339();
        let _ = automation_runs::insert_run_started(
            task.id.as_str(),
            task.name.as_str(),
            session_id.as_str(),
            started_at.as_str(),
        )
        .map_err(|err| {
            log::warn!(
                "failed to persist automation run started for '{}' (cc): {}",
                task.id,
                err
            );
            err
        });

        if let Err(err) = message_service::send_message_and_wait(
            session_id.as_str(),
            task.prompt.as_str(),
            &[],
            &cc_state,
            |_| {},
        )
        .await
        {
            let _ = automation_runs::mark_run_status_by_session(session_id.as_str(), "failed")
                .map_err(|db_err| {
                    log::warn!(
                        "failed to mark automation run failed for '{}' (cc): {}",
                        task.id,
                        db_err
                    );
                    db_err
                });
            let _ = session_service::disconnect(session_id.as_str(), &cc_state).await;
            return Err(err);
        }

        let _ = automation_runs::mark_run_status_by_session(session_id.as_str(), "completed")
            .map_err(|db_err| {
                log::warn!(
                    "failed to mark automation run completed for '{}' (cc): {}",
                    task.id,
                    db_err
                );
                db_err
            });
        let _ = session_service::disconnect(session_id.as_str(), &cc_state).await;
    }
    Ok(())
}

pub(super) async fn execute_task(
    task: AutomationTask,
    codex_ref: Arc<Mutex<Option<Arc<CodexAppServer>>>>,
    cc_state: CCState,
    event_sink: Arc<dyn EventSink>,
) {
    if task.agent == "cc" {
        if let Err(err) = run_task_with_cc(task.clone(), cc_state).await {
            log::error!("automation '{}' execution failed: {}", task.id, err);
            event_sink.emit(
                "automation:run/failed",
                json!({ "taskId": task.id, "error": err }),
            );
        } else {
            log::info!("automation '{}' executed", task.id);
        }
        return;
    }

    let codex = {
        let guard = codex_ref.lock().await;
        guard.clone()
    };

    let Some(codex) = codex else {
        let message = "codex app-server is not available".to_string();
        log::warn!("automation '{}' skipped because {}", task.id, message);
        event_sink.emit(
            "automation:run/failed",
            json!({ "taskId": task.id, "error": message }),
        );
        return;
    };

    if let Err(err) = run_task_with_codex(codex, task.clone(), Arc::clone(&event_sink)).await {
        log::error!("automation '{}' execution failed: {}", task.id, err);
        event_sink.emit(
            "automation:run/failed",
            json!({ "taskId": task.id, "error": err }),
        );
    } else {
        log::info!("automation '{}' executed", task.id);
    }
}
