//! Bots: named, long-lived keke agents.
//!
//! A bot is stored by `codexia-db`; this module turns a stored bot into a
//! running process. It is the one place that knows how — the Bot tab, a
//! scheduled routine and another bot asking for help all start a bot through
//! here, so a setting cannot take effect in one of them and not the others.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;

use codexia_db::bots::{BotRecord, parse_list};
use serde_json::{Value, json};

use crate::agents::{AcpAgentDef, find_preset};
use crate::client::{AcpClient, ConnectionPolicy, UnattendedApprovals};

/// Event carrying a bot's background activity: `{ botId, sessionId, status }`,
/// where `status` is `working`, `done`, `blocked` or `failed`.
pub const BOT_EVENT: &str = "bot:activity";

/// Longest an unattended turn may run before it is abandoned.
const UNATTENDED_TIMEOUT: Duration = Duration::from_secs(60 * 60);

/// The approval policy and sandbox mode a trust level stands for, in keke's
/// own spelling.
pub fn trust(level: &str) -> (&'static str, &'static str) {
    match level {
        "read_only" => ("on-request", "read_only"),
        "autonomous" => ("never", "workspace_write"),
        _ => ("on-request", "workspace_write"),
    }
}

/// Where a bot keeps its memory, kept apart from every other bot's.
pub fn memory_dir(bot_id: &str) -> Option<PathBuf> {
    Some(
        dirs::home_dir()?
            .join(".codexia")
            .join("bots")
            .join(bot_id)
            .join("memory"),
    )
}

/// The process definition for one bot.
///
/// keke has no notion of a named agent, so a bot's identity is handed over the
/// seams keke does have: spawn arguments, `KEKE_INSTRUCTIONS` (joined into the
/// system prompt after keke's own identity and before the project's
/// `AGENTS.md`) and `KEKE_MEMORY_DIR`.
///
/// Memory goes in through the env var rather than `--memory-dir`: an older
/// keke rejects an unknown flag and the bot would fail to spawn, whereas it
/// ignores an unknown env var.
pub fn agent_def(bot: &BotRecord) -> Result<AcpAgentDef, String> {
    let keke = find_preset(&bot.agent_id)
        .ok_or_else(|| format!("unknown ACP agent: {}", bot.agent_id))?;

    let mut args = keke.args.clone();
    if !bot.cwd.is_empty() {
        args.extend(["-C".to_string(), bot.cwd.clone()]);
    }

    let mut env = keke.env.clone();
    if let Some(prompt) = bot.system_prompt.as_deref().filter(|p| !p.trim().is_empty()) {
        env.insert("KEKE_INSTRUCTIONS".into(), prompt.to_string());
    }
    if let Some(dir) = memory_dir(&bot.id) {
        env.insert("KEKE_MEMORY_DIR".into(), dir.to_string_lossy().into_owned());
    }

    Ok(AcpAgentDef {
        id: format!("keke-bot-{}", bot.id),
        name: bot.name.clone(),
        args,
        env,
        ..keke
    })
}

/// The bot's chosen MCP servers, as ACP `McpServer` entries.
///
/// Explicit `keke:<name>` selections resolve against keke's native user file.
/// Legacy bare Codex names are deliberately not remapped: migration requires
/// adding a native definition and explicitly selecting its qualified name.
/// The built-in `codexia-bots` server is added when `delegate` is set, so
/// the bot can hand work to the others.
pub async fn mcp_servers(bot: &BotRecord, api_port: u16, delegate: bool) -> Vec<Value> {
    use crate::mcp::read_mcp_servers;

    let mut servers = Vec::new();
    if delegate {
        servers.push(bots_server(&bot.id, api_port));
    }
    let wanted = parse_list(&bot.mcp_servers);
    if wanted.is_empty() {
        return servers;
    }
    let configured = match read_mcp_servers().await {
        Ok(configured) => configured,
        Err(e) => {
            log::warn!("bot {}: could not read MCP servers: {e}", bot.id);
            return servers;
        }
    };
    servers.extend(selected_servers(&bot.id, wanted, &configured));
    servers
}

fn selected_servers(bot_id: &str, wanted: Vec<String>, configured: &crate::mcp::McpServers) -> Vec<Value> {
    use crate::mcp::acp_entry;
    let mut servers = Vec::new();
    for name in wanted {
        let Some(name) = name.strip_prefix("keke:") else {
            log::warn!("bot {bot_id}: legacy MCP selection `{name}` needs explicit keke migration");
            continue;
        };
        if name == "codexia-bots" { continue; }
        let Some(config) = configured.get(name) else {
            log::warn!("bot {bot_id}: MCP server `{name}` is not configured");
            continue;
        };
        if config.get("disabled").and_then(Value::as_bool) == Some(true) { continue; }
        // Strict composition excludes native discovery. Keep the identity
        // used by keke's own name-and-URL-scoped authentication store.
        match acp_entry(name, config) {
            Ok(server) => servers.push(server),
            Err(e) => log::warn!("bot {bot_id}: invalid MCP server `{name}`: {e}"),
        }
    }
    servers
}

/// Codexia's own MCP server, through which a bot reaches the other bots. The
/// URL identifies the caller; the bearer capability authenticates that identity.
fn bots_server(bot_id: &str, api_port: u16) -> Value {
    let capability = crate::delegation::issue(bot_id);
    json!({
        "type": "http",
        "name": "codexia-bots",
        "url": format!("http://127.0.0.1:{api_port}/mcp/bots?from={bot_id}"),
        "headers": [{ "name": "X-Codexia-Delegation", "value": capability }],
    })
}

/// The loopback port the desktop app serves Codexia's API on.
pub const LOCAL_PORT: u16 = 7419;

/// Everything about a bot's connection that is decided by its settings.
///
/// `delegate` is off for a bot that was itself asked by another bot: help is
/// one hop deep, so two bots can never keep handing a job back and forth.
pub async fn policy(
    bot: &BotRecord,
    api_port: u16,
    unattended: bool,
    delegate: bool,
) -> ConnectionPolicy {
    ConnectionPolicy {
        strict_mcp: true,
        mcp_servers: mcp_servers(bot, api_port, delegate).await,
        read_only: bot.trust_level == "read_only",
        unattended: unattended.then(|| UnattendedApprovals {
            allow_all: bot.trust_level == "autonomous",
            approved_tools: parse_list(&bot.approved_tools),
            ..Default::default()
        }),
    }
}

/// Point a freshly spawned keke at the bot's provider.
///
/// keke picks its route per process through `authenticate`, and the models a
/// session offers belong to that route, so this must run before `session/new`.
/// A bot with no provider keeps keke's own default. A route that cannot be
/// signed in to is reported, not fatal: the bot still opens on the default.
pub async fn select_provider(client: &AcpClient, bot: &BotRecord) {
    let Some(provider) = bot.provider.as_deref().filter(|p| !p.is_empty()) else {
        return;
    };
    if let Err(e) = client.authenticate(provider).await {
        log::warn!("bot {}: could not use provider {provider}: {e}", bot.name);
    }
}

/// Apply the bot's settings to a session its agent has just opened. An agent
/// that does not offer one of them says so per option; that is not a reason
/// to abandon the rest.
pub async fn apply_settings(client: &AcpClient, session_id: &str, bot: &BotRecord) {
    let (approval_policy, sandbox_mode) = trust(&bot.trust_level);
    let mut options = vec![
        ("approval_policy", approval_policy.to_string()),
        ("sandbox_mode", sandbox_mode.to_string()),
    ];
    if let Some(model) = bot.model.clone().filter(|m| !m.is_empty()) {
        options.push(("model", model));
    }
    if let Some(effort) = bot.reasoning_effort.clone().filter(|e| !e.is_empty()) {
        options.push(("reasoning_effort", effort));
    }
    for (id, value) in options {
        if let Err(e) = client
            .set_config_option(Some(session_id), id, &json!(value))
            .await
        {
            log::warn!("bot {}: could not set {id}: {e}", bot.name);
        }
    }
}

/// How an unattended turn ended.
#[derive(Debug)]
pub struct RunReport {
    pub session_id: String,
    /// A permission request had to be refused, so the job may be unfinished.
    pub blocked: bool,
    /// The agent's reply, as text.
    pub reply: String,
}

/// The agent's messages in a stored transcript, joined into one reply.
fn reply_text(session_id: &str) -> String {
    codexia_db::acp_sessions::get_updates(session_id)
        .unwrap_or_default()
        .iter()
        .filter(|u| u.get("sessionUpdate").and_then(Value::as_str) == Some("agent_message_chunk"))
        .filter_map(|u| u.get("content")?.get("text")?.as_str())
        .collect()
}

impl crate::AcpState {
    /// Run one prompt on a bot with nobody watching: its own short-lived
    /// process, a fresh session filed under the bot, permission requests
    /// answered from the bot's trust level and standing approvals.
    ///
    /// The conversation lands in the bot's history like any other, the bot's
    /// unread count goes up, and [`BOT_EVENT`] tells the UI as it goes.
    pub async fn run_bot_unattended(
        &self,
        bot_id: &str,
        prompt: &str,
        cwd: Option<&str>,
        delegate: bool,
        on_started: impl FnOnce(&str),
    ) -> Result<RunReport, String> {
        let bot = codexia_db::bots::get_bot(bot_id)?
            .ok_or_else(|| format!("No bot with id `{bot_id}`"))?;
        let cwd = cwd.filter(|c| !c.is_empty()).unwrap_or(&bot.cwd).to_string();
        let policy = policy(&bot, self.api_port(), true, delegate).await;
        let blocked = policy
            .unattended
            .as_ref()
            .map(|u| Arc::clone(&u.blocked))
            .unwrap_or_default();

        let connection_id = uuid::Uuid::new_v4().to_string();
        let (client, _) = AcpClient::spawn(
            connection_id.clone(),
            &agent_def(&bot)?,
            Some(&cwd),
            Some(bot.id.clone()),
            policy,
            self.sink(),
        )
        .await?;
        self.insert(connection_id.clone(), Arc::clone(&client));

        let result = async {
            let session = client.new_session(&cwd).await?;
            let session_id = session
                .get("sessionId")
                .and_then(Value::as_str)
                .ok_or("session/new returned no sessionId")?
                .to_string();
            apply_settings(&client, &session_id, &bot).await;
            on_started(&session_id);
            self.emit_bot(&bot.id, &session_id, "working");

            let turn = tokio::time::timeout(UNATTENDED_TIMEOUT, client.prompt(Some(&session_id), prompt))
                .await
                .unwrap_or_else(|_| Err("the bot did not finish within an hour".to_string()));
            if let Err(e) = turn {
                self.emit_bot(&bot.id, &session_id, "failed");
                return Err(e);
            }
            Ok::<_, String>(session_id)
        }
        .await;

        let _ = self.stop(&connection_id).await;
        let session_id = result?;

        let blocked = blocked.load(Ordering::Relaxed);
        if let Err(e) = codexia_db::bots::increment_unread(&bot.id) {
            log::warn!("bot {}: could not count the reply: {e}", bot.id);
        }
        self.emit_bot(&bot.id, &session_id, if blocked { "blocked" } else { "done" });
        Ok(RunReport {
            reply: reply_text(&session_id),
            session_id,
            blocked,
        })
    }

    fn emit_bot(&self, bot_id: &str, session_id: &str, status: &str) {
        // Anonymous usage count (opt-in, backend-gated); "working" is not an outcome.
        if matches!(status, "done" | "blocked" | "failed") {
            match status {
                "done" => codexia_telemetry::track(codexia_telemetry::Event::BotRunDone),
                "blocked" => codexia_telemetry::track(codexia_telemetry::Event::BotRunBlocked),
                "failed" => codexia_telemetry::track(codexia_telemetry::Event::BotRunFailed),
                _ => unreachable!(),
            }
        }
        self.sink().emit(
            BOT_EVENT,
            json!({ "botId": bot_id, "sessionId": session_id, "status": status }),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selections_keep_native_identity_and_do_not_remap_legacy_names() {
        let configured = [("native".into(), json!({"command":"fixture"})),
            ("other".into(), json!({"command":"unselected"})),
            ("disabled".into(), json!({"command":"disabled","disabled":true})),
            ("codexia-bots".into(), json!({"command":"must-not-delegate"}))].into();
        let wanted = vec!["native", "keke:native", "keke:disabled", "keke:codexia-bots"]
            .into_iter().map(str::to_string).collect();
        let servers = selected_servers("caller", wanted, &configured);
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0]["name"], "native");
        assert_eq!(servers[0]["command"], "fixture");
        assert!(selected_servers("caller", vec!["native".into()], &configured).is_empty());
        assert!(selected_servers("caller", vec![], &configured).is_empty());
    }

    #[tokio::test]
    async fn delegated_run_has_no_builtin_capability() {
        let bot: BotRecord = serde_json::from_value(json!({
            "id": "delegated", "name": "Delegated", "title": null,
            "avatar": "", "color": "", "agentId": "keke", "provider": null,
            "model": null, "reasoningEffort": null, "cwd": "",
            "systemPrompt": null, "trustLevel": "ask", "approvedTools": "[]",
            "mcpServers": "[]", "allowedBotIds": "[]", "pinned": false,
            "archived": false, "notificationsEnabled": true, "unreadCount": 0,
            "lastViewedAt": null, "createdAt": "", "updatedAt": ""
        })).unwrap();
        assert!(mcp_servers(&bot, 9000, false).await.is_empty());
        for unattended in [false, true] {
            for delegate in [false, true] {
                let policy = policy(&bot, 9000, unattended, delegate).await;
                assert!(policy.strict_mcp);
                assert_eq!(policy.mcp_servers.len(), usize::from(delegate));
                assert_eq!(policy.unattended.is_some(), unattended);
                for server in policy.mcp_servers {
                    crate::delegation::revoke(server["headers"][0]["value"].as_str().unwrap());
                }
            }
        }
        let servers = mcp_servers(&bot, 9000, true).await;
        let token = servers[0]["headers"][0]["value"].as_str().unwrap();
        assert!(crate::delegation::verify(token, &bot.id));
        crate::delegation::revoke(token);
    }

    #[test]
    fn trust_levels_map_to_keke_settings() {
        assert_eq!(trust("read_only"), ("on-request", "read_only"));
        assert_eq!(trust("ask"), ("on-request", "workspace_write"));
        assert_eq!(trust("autonomous"), ("never", "workspace_write"));
        // An unknown level falls back to the cautious default, not to autonomous.
        assert_eq!(trust("bogus"), ("on-request", "workspace_write"));
    }

    #[test]
    fn bots_server_names_the_asking_bot() {
        let server = bots_server("bot-1", 9000);
        assert_eq!(server["url"], "http://127.0.0.1:9000/mcp/bots?from=bot-1");
        assert_eq!(server["type"], "http");
        let token = server["headers"][0]["value"].as_str().unwrap();
        assert!(crate::delegation::verify(token, "bot-1"));
        assert!(!crate::delegation::verify(token, "bot-2"));
        crate::delegation::revoke(token);
    }
}
