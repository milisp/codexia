//! `codexia-bots`: the MCP server every bot gets from Codexia.
//!
//! Served as MCP's streamable HTTP transport in its plain-JSON form — every
//! request is answered in the POST's own response, with no event stream.
//! Each bot is given this server with its own id in the URL (`?from=<bot id>`)
//! and a capability bound to the session it was handed to.
//!
//! - `propose_draft` and `hand_back` leave something for the person instead
//!   of acting: a draft to review before anything is sent, or a step only a
//!   person can do. Both are stored and shown in Today and in the bot.
//! - `list_bots` and `ask_bot`, only when the capability allows asking.
//!   Asking a bot runs it unattended, exactly like a routine: its own process,
//!   its own trust level, and the conversation filed in its history with an
//!   unread mark, so the person can see what was asked of it and what it did.
use axum::extract::{Query, State as AxumState};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::{Value, json};

use codexia_acp::delegation::Grant;
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
    let Some(grant) = codexia_acp::delegation::grant(token, &from) else {
        return StatusCode::UNAUTHORIZED.into_response();
    };
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
            "instructions": instructions(grant.ask),
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": tools(grant.ask) })),
        "tools/call" => Ok(call_tool(&state, &from, &grant, &params).await),
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

fn instructions(ask: bool) -> String {
    let mut text = String::from(
        "Your person reviews anything that leaves this computer on their behalf. \
         Instead of sending an email or message, posting, publishing or commenting \
         yourself, save it with propose_draft. When a step needs something only \
         they can do (sign in, a password or one-time code, a CAPTCHA, an approval \
         in another app), call hand_back and end your turn. Never ask them to give \
         you a secret.",
    );
    if ask {
        text.push_str(
            " Other bots can take work too: call list_bots to see who they are, then \
             ask_bot with a self-contained request.",
        );
    }
    text
}

fn tools(ask: bool) -> Value {
    let mut tools = vec![
        json!({
            "name": "propose_draft",
            "description": "Save something you wrote for your person to review instead of \
                            sending, posting or publishing it yourself: an email reply, a \
                            message, a post, an issue or PR comment. They can edit it, then \
                            press Send, which resumes this conversation with the final text \
                            and asks you to carry out `action`, or discard it. Nothing is \
                            sent until they press Send.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "A short label, e.g. `Reply to Ana about the invoice`." },
                    "body": { "type": "string", "description": "The full text, ready to send." },
                    "action": { "type": "string", "description": "What you will do with it on Send, e.g. `send it as a reply in the Gmail thread with Ana`. Leave out when there is nothing to send and the person will copy it." },
                },
                "required": ["title", "body"],
            },
        }),
        json!({
            "name": "hand_back",
            "description": "Hand a step back to your person when only they can do it: \
                            signing in, a password or one-time code, a CAPTCHA, confirming \
                            identity, approving in another app. Say exactly what to do; never \
                            ask for the secret itself. After calling this, end your turn. \
                            When they press Done, this conversation resumes.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "A short label, e.g. `Sign in to the supplier portal`." },
                    "steps": { "type": "string", "description": "What they need to do, step by step (Markdown)." },
                    "url": { "type": "string", "description": "Where they do it, if there is a page for it." },
                },
                "required": ["title", "steps"],
            },
        }),
    ];
    if ask {
        tools.push(json!({
            "name": "list_bots",
            "description": "List the other bots you can ask for help: id, name and role.",
            "inputSchema": { "type": "object", "properties": {} },
        }));
        tools.push(json!({
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
        }));
    }
    Value::Array(tools)
}

/// A non-empty, trimmed string argument.
fn arg<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args.get(key).and_then(Value::as_str).map(str::trim).filter(|v| !v.is_empty())
}

/// Store a draft or hand-back for the person and tell every client.
fn leave_for_person(
    state: &WebServerState,
    from: &str,
    grant: &Grant,
    kind: &str,
    args: &Value,
) -> Value {
    let Some(session_id) = grant.session.as_deref() else {
        return text_result("this capability is not attached to a conversation", true);
    };
    let (body_key, extra_key) = if kind == "draft" { ("body", "action") } else { ("steps", "url") };
    let (Some(title), Some(body)) = (arg(args, "title"), arg(args, body_key)) else {
        return text_result(format!("title and {body_key} are required"), true);
    };
    let id = format!("{kind}-{}", uuid::Uuid::new_v4());
    let item = match codexia_db::bot_inbox::insert(
        &id,
        from,
        session_id,
        kind,
        title,
        body,
        arg(args, extra_key),
    ) {
        Ok(item) => item,
        Err(e) => return text_result(format!("could not save it: {e}"), true),
    };
    state.acp_state.notify_inbox(&item);
    if kind == "draft" {
        text_result(
            "Saved for your person to review. Do not send it yourself. If they press Send, \
             this conversation resumes with the final text.",
            false,
        )
    } else {
        text_result(
            "Handed back to your person. End your turn now with one short sentence; do not \
             retry. This conversation resumes when they press Done.",
            false,
        )
    }
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

async fn call_tool(state: &WebServerState, from: &str, grant: &Grant, params: &Value) -> Value {
    let name = params.get("name").and_then(Value::as_str).unwrap_or_default();
    let args = params.get("arguments").cloned().unwrap_or(Value::Null);
    match name {
        "propose_draft" => return leave_for_person(state, from, grant, "draft", &args),
        "hand_back" => return leave_for_person(state, from, grant, "handback", &args),
        "list_bots" | "ask_bot" if grant.ask => {}
        other => return text_result(format!("unknown tool: {other}"), true),
    }
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
                .run_bot_unattended(
                    &target.id,
                    &prompt,
                    None,
                    false,
                    serde_json::json!({ "kind": "bot", "name": asker }),
                    None,
                    |_| {},
                )
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
    fn drafts_and_hand_backs_are_always_offered_asking_only_when_granted() {
        let names = |ask| -> Vec<String> {
            tools(ask).as_array().unwrap().iter()
                .map(|t| t["name"].as_str().unwrap().to_string()).collect()
        };
        assert_eq!(names(false), ["propose_draft", "hand_back"]);
        assert_eq!(names(true), ["propose_draft", "hand_back", "list_bots", "ask_bot"]);
        assert!(!instructions(false).contains("ask_bot"));
        assert!(instructions(true).contains("ask_bot"));
    }

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
