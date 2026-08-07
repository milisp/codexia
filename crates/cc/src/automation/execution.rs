use chrono::Utc;
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::services::{message_service, session_service};
use crate::{CCState, CCConnectParams};
use codexia_codex::CodexAppServer;
use codexia_db::automation_runs;
use codexia_shared::event_sink::EventSink;

use super::model::{AutomationTask, default_model, default_model_provider, normalize_model_provider};

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
    log::info!("Starting CC automation task {}: {}", task.id, task.name);
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
                permission_mode: Some("bypassPermissions".to_string()),
                resume_id: None,
            },
            &cc_state,
        )
        .await?;
        log::info!("[CC automation] Connected to Claude session {}", session_id);

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

        log::info!("[CC automation] Sending prompt to session {}...", session_id);
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

/// Pulls the `--goal-id <value>` flag out of an `AutomationTask.prompt` string. The task
/// model has no dedicated `goal_id` field — the goal-id lives only inside the prompt text
/// a human (or Codexia's UI) fills in, per the approved prompt template. Returns `None`
/// for any prompt that isn't a `loopx-tick`-shaped instruction, or where the flag is
/// malformed/missing its value — both cases are treated identically by the caller: no
/// pre-flight opinion, proceed as if this feature didn't exist.
fn extract_goal_id(prompt: &str) -> Option<String> {
    let mut tokens = prompt.split_whitespace();
    tokens.find(|token| *token == "--goal-id")?;
    tokens
        .next()
        .map(|value| value.trim_matches('`').to_string())
        .filter(|value| !value.is_empty() && !value.starts_with("--"))
}

/// Interprets the result of shelling out to `loopx --format json quota should-run`.
/// Returns `true` only when the process exited 0, produced valid JSON, and that JSON has
/// `"should_run": false` (a real boolean `false`, not a string or other type) — the one
/// case approved as a real reason to skip launching a session. Every other outcome
/// returns `false`: an infra error here must never silently skip a wake, since an
/// unnecessary session is cheap and reversible while a silently-skipped wake is not.
fn should_skip_from_output(exit_status: i32, stdout: &str) -> bool {
    if exit_status != 0 {
        return false;
    }
    match serde_json::from_str::<Value>(stdout) {
        Ok(json) => json.get("should_run").and_then(Value::as_bool) == Some(false),
        Err(_) => false,
    }
}

#[cfg(test)]
mod preflight_tests {
    use super::*;

    #[test]
    fn extract_goal_id_finds_the_flag_value() {
        let prompt = "Run alphalayer loopx-tick myflows.digest:flow --goal-id nightly-digest in this directory via the shell. Report its one-line output, then stop.";
        assert_eq!(extract_goal_id(prompt), Some("nightly-digest".to_string()));
    }

    #[test]
    fn extract_goal_id_strips_trailing_backtick() {
        let prompt = "Run `alphalayer loopx-tick myflows.digest:flow --goal-id nightly-digest` in this directory via the shell. Report its one-line output, then stop.";
        assert_eq!(extract_goal_id(prompt), Some("nightly-digest".to_string()));
    }

    #[test]
    fn extract_goal_id_returns_none_when_absent() {
        let prompt = "Summarize the open PRs in this repo.";
        assert_eq!(extract_goal_id(prompt), None);
    }

    #[test]
    fn extract_goal_id_returns_none_for_malformed_flag() {
        let prompt = "Run `alphalayer loopx-tick myflows.digest:flow --goal-id` with nothing after it.";
        assert_eq!(extract_goal_id(prompt), None);
    }

    #[test]
    fn extract_goal_id_returns_none_when_flag_is_followed_by_another_flag() {
        let prompt = "Run `alphalayer loopx-tick myflows.digest:flow --goal-id --other-flag value` in this directory via the shell.";
        assert_eq!(extract_goal_id(prompt), None);
    }

    #[test]
    fn extract_goal_id_does_not_match_a_flag_that_merely_contains_goal_id_as_a_substring() {
        let prompt = "Run task --goal-id-format short in this directory.";
        assert_eq!(extract_goal_id(prompt), None);
    }

    #[test]
    fn should_skip_from_output_is_false_when_should_run_reports_true() {
        // "loopx" prints `{"should_run": true}` — proceed with the session.
        let outcome = should_skip_from_output(0, r#"{"should_run": true}"#);
        assert!(!outcome);
    }

    #[test]
    fn should_skip_from_output_is_true_only_on_a_clean_false() {
        let outcome = should_skip_from_output(0, r#"{"should_run": false, "reason": "quota exhausted"}"#);
        assert!(outcome);
    }

    #[test]
    fn should_skip_from_output_is_false_on_nonzero_exit() {
        // Fail open: an infra error must never silently skip a wake.
        let outcome = should_skip_from_output(1, "");
        assert!(!outcome);
    }

    #[test]
    fn should_skip_from_output_is_false_on_nonzero_exit_even_with_valid_should_run_false_json() {
        // Exit-code failure must override an otherwise-parseable negative signal.
        let outcome = should_skip_from_output(1, r#"{"should_run": false, "reason": "quota exhausted"}"#);
        assert!(!outcome);
    }

    #[test]
    fn should_skip_from_output_is_false_on_unparseable_json() {
        let outcome = should_skip_from_output(0, "not json");
        assert!(!outcome);
    }

    #[test]
    fn should_skip_from_output_is_false_when_should_run_field_missing() {
        // Missing field defaults to "runnable" (proceed) rather than assuming skip.
        let outcome = should_skip_from_output(0, r#"{"reason": "no field here"}"#);
        assert!(!outcome);
    }

    #[test]
    fn should_skip_from_output_is_false_when_should_run_is_wrong_type() {
        // Fail open on schema mismatch, not just on totally-unparseable JSON.
        let outcome = should_skip_from_output(0, r#"{"should_run": "true"}"#);
        assert!(!outcome);
    }
}
