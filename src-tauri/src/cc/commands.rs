use super::mcp::{
    ClaudeCodeMcpServer, ClaudeCodeResponse, cc_list_projects as mcp_cc_list_projects,
    cc_mcp_add as mcp_cc_mcp_add, cc_mcp_disable as mcp_cc_mcp_disable,
    cc_mcp_enable as mcp_cc_mcp_enable, cc_mcp_get as mcp_cc_mcp_get,
    cc_mcp_list as mcp_cc_mcp_list, cc_mcp_remove as mcp_cc_mcp_remove,
};
use super::services::{
    message_service, session_service, settings_service, skill_service,
};
use super::state::CCState;
use super::types::{AgentOptions, CCConnectParams};
use session_service::SessionListResult;
use tauri::State;

#[tauri::command]
pub async fn cc_connect(
    params: CCConnectParams,
    state: State<'_, CCState>,
) -> Result<(), String> {
    session_service::connect(params, &state).await
}

#[tauri::command]
pub async fn cc_send_message(
    session_id: String,
    message: String,
    image_paths: Option<Vec<String>>,
    state: State<'_, CCState>,
) -> Result<(), String> {
    let image_paths = image_paths.unwrap_or_default();
    let cc_state = state.inner().clone();
    let sid = session_id.clone();
    message_service::send_message(&session_id, &message, &image_paths, &state, move |msg| {
        if let Ok(mut payload) = serde_json::to_value(&msg) {
            if let Some(obj) = payload.as_object_mut() {
                // Always override session_id with the caller's sid so that resumed sessions
                // (which may produce a new SDK session_id) are still routed to the correct card.
                obj.insert("session_id".to_string(), serde_json::Value::String(sid.clone()));
            }
            cc_state.emit("cc-message", payload);
        }
    })
    .await
}

#[tauri::command]
pub async fn cc_disconnect(session_id: String, state: State<'_, CCState>) -> Result<(), String> {
    session_service::disconnect(&session_id, &state).await
}

#[tauri::command]
pub async fn cc_new_session(
    options: AgentOptions,
    initial_message: String,
    state: State<'_, CCState>,
) -> Result<String, String> {
    session_service::new_session_and_send(options, initial_message, &state).await
}

#[tauri::command]
pub async fn cc_interrupt(session_id: String, state: State<'_, CCState>) -> Result<(), String> {
    session_service::interrupt(&session_id, &state).await
}

#[tauri::command]
pub async fn cc_resume_session(
    session_id: String,
    options: AgentOptions,
    state: State<'_, CCState>,
) -> Result<(), String> {
    session_service::resume_session(session_id, options, &state).await
}

#[tauri::command]
pub fn cc_get_installed_skills() -> Result<Vec<String>, String> {
    skill_service::get_installed_skills()
}

#[tauri::command]
pub fn cc_get_slash_commands(cwd: Option<String>) -> Result<Vec<String>, String> {
    skill_service::get_slash_commands(cwd.as_deref())
}

#[tauri::command]
pub fn cc_get_settings() -> Result<serde_json::Value, String> {
    settings_service::get_settings()
}

#[tauri::command]
pub fn cc_update_settings(settings: serde_json::Value) -> Result<(), String> {
    settings_service::update_settings(settings)
}

#[tauri::command]
pub fn cc_list_sessions(
    directory: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    include_worktrees: Option<bool>,
) -> Result<SessionListResult, String> {
    session_service::list_sessions(
        directory.as_deref(),
        limit,
        offset.unwrap_or(0),
        include_worktrees.unwrap_or(true),
    )
}

#[tauri::command]
pub fn cc_delete_session(session_id: String) -> Result<(), String> {
    claude_agent_sdk_rs::session_mutations::delete_session(&session_id, None)
        .map_err(|e| e.to_string())?;
    super::db::SessionCache::new()?.delete_session(&session_id)?;
    Ok(())
}

#[tauri::command]
pub fn cc_get_session_file_path(session_id: String) -> Result<Option<String>, String> {
    Ok(crate::cc::scan::find_session_file(&session_id))
}

#[tauri::command]
pub async fn cc_mcp_list(working_dir: String) -> Result<Vec<ClaudeCodeMcpServer>, String> {
    mcp_cc_mcp_list(working_dir).await
}

#[tauri::command]
pub async fn cc_mcp_get(name: String, working_dir: String) -> Result<ClaudeCodeMcpServer, String> {
    mcp_cc_mcp_get(name, working_dir).await
}

#[tauri::command]
pub async fn cc_mcp_add(
    request: ClaudeCodeMcpServer,
    working_dir: String,
) -> Result<ClaudeCodeResponse, String> {
    mcp_cc_mcp_add(request, working_dir).await
}

#[tauri::command]
pub async fn cc_mcp_remove(
    name: String,
    working_dir: String,
    scope: String,
) -> Result<ClaudeCodeResponse, String> {
    mcp_cc_mcp_remove(name, working_dir, scope).await
}

#[tauri::command]
pub async fn cc_list_projects() -> Result<Vec<String>, String> {
    mcp_cc_list_projects().await
}

#[tauri::command]
pub async fn cc_mcp_disable(
    name: String,
    working_dir: String,
) -> Result<ClaudeCodeResponse, String> {
    mcp_cc_mcp_disable(name, working_dir).await
}

#[tauri::command]
pub async fn cc_mcp_enable(
    name: String,
    working_dir: String,
) -> Result<ClaudeCodeResponse, String> {
    mcp_cc_mcp_enable(name, working_dir).await
}
#[tauri::command]
pub async fn cc_resolve_permission(
    request_id: String,
    decision: String,
    state: State<'_, CCState>,
) -> Result<(), String> {
    state.resolve_permission(&request_id, decision)
}

#[tauri::command]
pub async fn cc_set_permission_mode(
    session_id: String,
    mode: String,
    state: State<'_, CCState>,
) -> Result<(), String> {
    session_service::set_permission_mode(&session_id, &mode, &state).await
}
