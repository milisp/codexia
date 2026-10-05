//! `codexia-bots`: the MCP server a bot uses to reach the other bots.
//!
//! Served as MCP's streamable HTTP transport in its plain-JSON form — every
//! request is answered in the POST's own response, with no event stream —
//! which is all two tools need. Each bot is given this server with its own id
//! in the URL (`?from=<bot id>`), so a bot never sees itself as someone to ask.
//!
//! Asking a bot runs it unattended, exactly like a routine: its own process,
//! its own trust level, and the conversation filed in its history with an
//! unread mark, so the person can see what was asked of it and what it did.

use axum::extract::{Query, State as AxumState};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::{Value, json};

use codexia_db::bots::BotRecord;

use crate::types::WebServerState;

#[derive(Deserialize)]
pub(crate) struct BotsMcpQuery {
    /// The bot this server was handed to.
    #[serde(default)]
    from: Option<String>,
}

/// The newest protocol revision this server knows. A client asking for
/// another one is answered with this, as the spec allows.
const PROTOCOL_VERSION: &str = "2025-06-18";

pub(crate) async fn api_bots_mcp(
    AxumState(state): AxumState<WebServerState>,
    Query(query): Query<BotsMcpQuery>,
    headers: HeaderMap,
    Json(message): Json<Value>,
) -> Response {
    let from = query.from.unwrap_or_default();
    let token = headers.get("X-Codexia-Delegation")
        .and_then(|value| value.to_str().ok()).unwrap_or_default();
    if !codexia_acp::delegation::verify(token, &from) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let Some(method) = message.get("method").and_then(Value::as_str) else {
        // A response or a malformed frame: nothing this server asked for.
        return StatusCode::ACCEPTED.into_response();
    };
    let Some(id) = message.get("id").cloned() else {
        // Notifications (`notifications/initialized`, ...) need no answer.
        return StatusCode::ACCEPTED.into_response();
    };
    let params = message.get("params").cloned().unwrap_or(Value::Null);

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": params
                .get("protocolVersion")
                .and_then(Value::as_str)
                .unwrap_or(PROTOCOL_VERSION),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "codexia-bots", "version": env!("CARGO_PKG_VERSION") },
            "instructions": "Other bots you can hand work to. Call list_bots to see who \
                             they are, then ask_bot with a self-contained request.",
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": tools() })),
        "tools/call" => Ok(call_tool(&state, &from, &params).await),
        other => Err(format!("method not found: {other}")),
    };

    Json(match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(message) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32601, "message": message },
        }),
    })
    .into_response()
}

fn tools() -> Value {
    json!([
        {
            "name": "list_bots",
            "description": "List the other bots you can ask for help: id, name and role.",
            "inputSchema": { "type": "object", "properties": {} },
        },
        {
            "name": "ask_bot",
            "description": "Hand a job to another bot and wait for its answer. It works in \
                            its own project with its own permissions and does not see this \
                            conversation, so make the message self-contained.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "bot": { "type": "string", "description": "The bot's id or name." },
                    "message": { "type": "string", "description": "What to ask it." },
                },
                "required": ["bot", "message"],
            },
        },
    ])
}

/// A tool result. Tool failures are results with `isError`, not JSON-RPC
/// errors, so the model gets to read them and adjust.
fn text_result(text: impl Into<String>, is_error: bool) -> Value {
    json!({ "content": [{ "type": "text", "text": text.into() }], "isError": is_error })
}

fn authorized_target(from: &str, allowed: &[String], target: &str, archived: bool) -> bool {
    !archived && target != from && allowed.iter().any(|id| id == target)
}

/// Only explicitly authorized outgoing targets. Missing/archived callers fail closed.
fn colleagues(from: &str) -> Result<Vec<BotRecord>, String> {
    let caller = codexia_db::bots::get_bot(from)?
        .filter(|bot| !bot.archived)
        .ok_or_else(|| "collaboration requires an active caller bot".to_string())?;
    let allowed = codexia_db::bots::parse_list(&caller.allowed_bot_ids);
    Ok(codexia_db::bots::list_bots(false)?
        .into_iter()
        .filter(|bot| authorized_target(from, &allowed, &bot.id, bot.archived))
        .collect())
}

async fn call_tool(state: &WebServerState, from: &str, params: &Value) -> Value {
    let name = params.get("name").and_then(Value::as_str).unwrap_or_default();
    let args = params.get("arguments").cloned().unwrap_or(Value::Null);
    let bots = match colleagues(from) {
        Ok(bots) => bots,
        Err(e) => return text_result(e, true),
    };

    match name {
        "list_bots" => {
            let list: Vec<Value> = bots
                .iter()
                .map(|bot| json!({ "id": bot.id, "name": bot.name, "title": bot.title }))
                .collect();
            text_result(Value::Array(list).to_string(), false)
        }
        "ask_bot" => {
            let wanted = args.get("bot").and_then(Value::as_str).unwrap_or_default().trim();
            let message = args.get("message").and_then(Value::as_str).unwrap_or_default().trim();
            if message.is_empty() {
                return text_result("message is required", true);
            }
            let Some(target) = bots
                .iter()
                .find(|bot| bot.id == wanted || bot.name.eq_ignore_ascii_case(wanted))
            else {
                return text_result("target bot is unavailable or not authorized", true);
            };

            let asker = codexia_db::bots::get_bot(from)
                .ok()
                .flatten()
                .map(|bot| bot.name)
                .unwrap_or_else(|| "another bot".to_string());
            let prompt = format!("{asker} asks:\n\n{message}");
            codexia_telemetry::track(codexia_telemetry::Event::BotAsk);

            match state
                .acp_state
                .run_bot_unattended(&target.id, &prompt, None, false, |_| {})
                .await
            {
                Ok(report) => {
                    let mut reply = report.reply;
                    if report.blocked {
                        reply.push_str(
                            "\n\n(Note: part of this job was refused because it needed an \
                             approval this bot does not have.)",
                        );
                    }
                    text_result(reply, false)
                }
                Err(e) => text_result(format!("{} could not answer: {e}", target.name), true),
            }
        }
        other => text_result(format!("unknown tool: {other}"), true),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outgoing_allowlist_excludes_self_archived_and_unlisted_targets() {
        let allowed = vec!["target".to_string(), "caller".to_string()];
        assert!(authorized_target("caller", &allowed, "target", false));
        assert!(!authorized_target("caller", &allowed, "caller", false));
        assert!(!authorized_target("caller", &allowed, "target", true));
        assert!(!authorized_target("caller", &allowed, "other", false));
        assert!(!authorized_target("caller", &[], "target", false));
        assert!(!authorized_target("caller", &codexia_db::bots::parse_list("invalid"), "target", false));
    }
}
