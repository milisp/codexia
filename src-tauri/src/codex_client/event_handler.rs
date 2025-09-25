use serde_json::{self, Value};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{ChildStderr, ChildStdout};

use crate::protocol::Event;

pub struct EventHandler;

impl EventHandler {
    pub fn start_stdout_handler(app: AppHandle, stdout: ChildStdout, session_id: String) {
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            log::debug!("Starting stdout reader for session: {}", session_id);

            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }

                // log::debug!("📥 Received line from codex: {}", line);

                // Try to parse as the structured Event format first
                if let Ok(event) = serde_json::from_str::<Event>(&line) {
                    // log::debug!("📨 Parsed structured event: {:?}", event);

                    // Log the event for debugging
                    if let Some(event_session_id) = Self::get_session_id_from_event(&event) {
                        log::debug!("Event for session: {}", event_session_id);
                    }

                    let normalized_msg = match serde_json::to_value(&event.msg) {
                        Ok(value) => value,
                        Err(err) => {
                            log::error!("Failed to serialize event msg to JSON: {}", err);
                            Value::Null
                        }
                    };

                    // Emit structured event with attached session_id for routing in the UI
                    let wrapped = serde_json::json!({
                        "id": event.id,
                        "msg": normalized_msg,
                        "session_id": session_id.clone()
                    });
                    if let Err(e) = app.emit("codex-events", &wrapped) {
                        log::error!("Failed to emit structured event: {}", e);
                    }
                } else {
                    // If structured parsing fails, try to parse as generic JSON and emit as raw event
                    match serde_json::from_str::<serde_json::Value>(&line) {
                        Ok(json_value) => {
                            log::debug!("📨 Parsed raw JSON event: {:?}", json_value);

                            // Emit raw JSON event with a wrapper structure
                            let raw_event = serde_json::json!({
                                "type": "raw_event",
                                "session_id": session_id.clone(),
                                "data": json_value
                            });

                            if let Err(e) = app.emit("codex-raw-events", &raw_event) {
                                log::error!("Failed to emit raw event: {}", e);
                            }
                        }
                        Err(e) => {
                            log::warn!(
                                "Failed to parse codex output as JSON: {} - Line: {}",
                                e,
                                line
                            );

                            // Emit as plain text event for debugging
                            let text_event = serde_json::json!({
                                "type": "text_output",
                                "session_id": session_id.clone(),
                                "content": line
                            });

                            if let Err(e) = app.emit("codex-text-output", &text_event) {
                                log::error!("Failed to emit text event: {}", e);
                            }
                        }
                    }
                }
            }
            log::debug!("Stdout reader terminated for session: {}", session_id);
        });
    }

    pub fn start_stderr_handler(stderr: ChildStderr, session_id: String) {
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            log::debug!("Starting stderr reader for session: {}", session_id);

            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }

                // Check if this is an informational log from codex (not an actual error)
                if Self::is_informational_log(&line) {
                    log::debug!("📋 Codex info [{}]: {}", session_id, line);
                } else {
                    // This appears to be an actual error
                    log::error!("🚨 Codex stderr [{}]: {}", session_id, line);
                }
            }
            log::debug!("Stderr reader terminated for session: {}", session_id);
        });
    }

    fn is_informational_log(line: &str) -> bool {
        // Check for common informational log patterns from codex
        line.contains("INFO codex_core::codex:") ||
        line.contains("DEBUG") ||
        line.contains("TRACE") ||
        line.contains("FunctionCall:") ||
        line.contains("codex_core::codex") ||
        // Timestamp patterns that indicate structured logging
        line.starts_with("20") && line.contains("Z  INFO") ||
        line.starts_with("20") && line.contains("Z  DEBUG") ||
        line.starts_with("20") && line.contains("Z  TRACE")
    }

    fn get_session_id_from_event(event: &Event) -> Option<String> {
        match &event.msg {
            crate::protocol::EventMsg::SessionConfigured { session_id, .. } => {
                Some(session_id.clone())
            }
            _ => None,
        }
    }

}
