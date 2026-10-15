use axum::{Json, extract::State as AxumState};
use serde::Deserialize;

use codexia_db::acp_sessions::AcpSessionRecord;
use codexia_db::bot_inbox::BotInboxItem;
use codexia_db::bot_runs::BotRunRecord;
use codexia_db::bots::{BotPatch, BotRecord};

use crate::types::{ErrorResponse, WebServerState};

fn err(e: String) -> ErrorResponse {
    ErrorResponse { error: e }
}

#[derive(Deserialize)]
pub(crate) struct ListBotsParams {
    #[serde(default)]
    pub include_archived: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateBotParams {
    pub id: String,
    pub name: String,
    pub avatar: String,
    pub color: String,
    pub cwd: String,
    /// Which ACP preset backs the bot. Defaults to keke, the only one the Bot
    /// tab offers today.
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub trust_level: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateBotParams {
    pub id: String,
    #[serde(flatten)]
    pub patch: BotPatch,
}

#[derive(Deserialize)]
pub(crate) struct BotIdParams {
    pub id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BotSessionsParams {
    pub bot_id: String,
    #[serde(default)]
    pub limit: Option<usize>,
}

pub(crate) async fn api_list_bots(
    Json(params): Json<ListBotsParams>,
) -> Result<Json<Vec<BotRecord>>, ErrorResponse> {
    codexia_db::bots::list_bots(params.include_archived)
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_create_bot(
    Json(params): Json<CreateBotParams>,
) -> Result<Json<BotRecord>, ErrorResponse> {
    let bot = codexia_db::bots::create_bot(
        &params.id,
        &params.name,
        &params.avatar,
        &params.color,
        params.agent_id.as_deref().unwrap_or("keke"),
        &params.cwd,
        params.trust_level.as_deref().unwrap_or("ask"),
    )
    .map_err(err)?;
    codexia_telemetry::track(codexia_telemetry::Event::BotCreated);
    Ok(Json(bot))
}

pub(crate) async fn api_update_bot(
    Json(params): Json<UpdateBotParams>,
) -> Result<Json<BotRecord>, ErrorResponse> {
    codexia_db::bots::update_bot(&params.id, &params.patch)
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_delete_bot(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<BotIdParams>,
) -> Result<Json<()>, ErrorResponse> {
    codexia_db::bots::delete_bot(&params.id).map_err(err)?;

    // A routine outlives nothing it runs as: left behind, it would fail on
    // every tick for a bot that no longer exists.
    if let Some(automation) = &state.automation {
        let tasks = codexia_automation::list_automations(automation)
            .await
            .map_err(err)?;
        for task in tasks
            .into_iter()
            .filter(|task| task.bot_id.as_deref() == Some(params.id.as_str()))
        {
            codexia_automation::delete_automation(automation, task.id)
                .await
                .map_err(err)?;
        }
    }
    Ok(Json(()))
}

/// One bot's conversations, newest first. A table read: listing a bot must
/// never wake its agent process.
pub(crate) async fn api_bot_sessions(
    Json(params): Json<BotSessionsParams>,
) -> Result<Json<Vec<AcpSessionRecord>>, ErrorResponse> {
    codexia_db::acp_sessions::list_bot_sessions(&params.bot_id, params.limit.unwrap_or(100))
        .map(Json)
        .map_err(err)
}

#[derive(Deserialize)]
pub(crate) struct BotRunsParams {
    #[serde(default)]
    pub limit: Option<usize>,
}

/// Recent unattended runs of every bot, newest first: what Today lists as
/// done since you looked.
pub(crate) async fn api_bot_runs(
    Json(params): Json<BotRunsParams>,
) -> Result<Json<Vec<BotRunRecord>>, ErrorResponse> {
    codexia_db::bot_runs::list_recent(params.limit.unwrap_or(100))
        .map(Json)
        .map_err(err)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BotInboxParams {
    #[serde(default)]
    pub bot_id: Option<String>,
}

/// Open drafts and hand-backs, oldest first, for one bot or all of them.
pub(crate) async fn api_bot_inbox(
    Json(params): Json<BotInboxParams>,
) -> Result<Json<Vec<BotInboxItem>>, ErrorResponse> {
    codexia_db::bot_inbox::list_open(params.bot_id.as_deref())
        .map(Json)
        .map_err(err)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResolveInboxParams {
    pub id: String,
    /// `send` or `discard` for a draft; `done` or `dismiss` for a hand-back.
    pub action: String,
    /// The draft as the person edited it.
    #[serde(default)]
    pub body: Option<String>,
    /// What the person wants the bot to know after a hand-back.
    #[serde(default)]
    pub note: Option<String>,
}

/// The turn that continues the conversation after the person acted.
fn resume_prompt(item: &BotInboxItem, note: Option<&str>) -> Option<String> {
    match (item.kind.as_str(), item.status.as_str()) {
        ("draft", "sent") => Some(format!(
            "I approved your draft \"{}\". Send it now: {}\n\nUse exactly this text:\n\n{}",
            item.title,
            item.action.as_deref().unwrap_or_default(),
            item.body
        )),
        ("handback", "done") => {
            let mut prompt =
                format!("I finished the step you handed back: \"{}\".", item.title);
            if let Some(note) = note.map(str::trim).filter(|n| !n.is_empty()) {
                prompt.push_str(&format!("\n\n{note}"));
            }
            prompt.push_str("\n\nContinue the task.");
            Some(prompt)
        }
        _ => None,
    }
}

/// Act on a draft or hand-back. Send and Done continue the bot's conversation
/// in the background, as an unattended run under the bot's usual approval
/// rules; Discard and Dismiss only close the item.
pub(crate) async fn api_resolve_bot_inbox(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ResolveInboxParams>,
) -> Result<Json<BotInboxItem>, ErrorResponse> {
    let item = codexia_db::bot_inbox::get(&params.id)
        .map_err(err)?
        .ok_or_else(|| err(format!("No inbox item `{}`", params.id)))?;
    let status = match (item.kind.as_str(), params.action.as_str()) {
        ("draft", "send") if item.action.as_deref().is_some_and(|a| !a.trim().is_empty()) => "sent",
        ("draft", "send") => return Err(err("This draft has nothing to send; copy it instead.".into())),
        ("draft", "discard") => "discarded",
        ("handback", "done") => "done",
        ("handback", "dismiss") => "dismissed",
        (kind, action) => return Err(err(format!("Cannot {action} a {kind}"))),
    };
    let body = params.body.as_deref().map(str::trim).filter(|b| !b.is_empty());
    let item = codexia_db::bot_inbox::resolve(&item.id, status, body)
        .map_err(err)?
        .ok_or_else(|| err("Already handled".to_string()))?;
    state.acp_state.notify_inbox(&item);

    if let Some(prompt) = resume_prompt(&item, params.note.as_deref()) {
        let acp = state.acp_state.clone();
        let trigger = serde_json::json!({ "kind": item.kind, "name": item.title });
        let (bot_id, session_id) = (item.bot_id.clone(), item.session_id.clone());
        tokio::spawn(async move {
            if let Err(e) = acp.resume_bot(&bot_id, &session_id, &prompt, trigger).await {
                log::warn!("bot {bot_id}: could not continue after the inbox item: {e}");
            }
        });
    }
    Ok(Json(item))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(kind: &str, status: &str) -> BotInboxItem {
        BotInboxItem {
            id: "i".into(),
            bot_id: "b".into(),
            session_id: "s".into(),
            kind: kind.into(),
            title: "Reply to Ana".into(),
            body: "Hi Ana, edited".into(),
            action: Some("reply in the Gmail thread".into()),
            status: status.into(),
            created_at: String::new(),
            resolved_at: None,
        }
    }

    #[test]
    fn only_send_and_done_continue_the_conversation() {
        let sent = resume_prompt(&item("draft", "sent"), None).unwrap();
        assert!(sent.contains("reply in the Gmail thread"));
        assert!(sent.ends_with("Hi Ana, edited"));
        let done = resume_prompt(&item("handback", "done"), Some(" Signed in as ops ")).unwrap();
        assert!(done.contains("Signed in as ops\n\nContinue the task."));
        assert!(resume_prompt(&item("draft", "discarded"), None).is_none());
        assert!(resume_prompt(&item("handback", "dismissed"), None).is_none());
    }
}
