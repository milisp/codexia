use codexia_acp::{AcpAgentDef, AcpSessionRecord, AcpStartResult, AcpState};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn acp_list_agents() -> Result<Vec<AcpAgentDef>, String> {
    Ok(codexia_acp::list_agents())
}

#[tauri::command]
pub async fn acp_start(
    agent_id: String,
    cwd: String,
    custom: Option<AcpAgentDef>,
    state: State<'_, AcpState>,
) -> Result<AcpStartResult, String> {
    state.start(&agent_id, &cwd, custom).await
}

#[tauri::command]
pub async fn acp_prompt(
    connection_id: String,
    session_id: Option<String>,
    text: String,
    state: State<'_, AcpState>,
) -> Result<Value, String> {
    state.prompt(&connection_id, session_id.as_deref(), &text).await
}

#[tauri::command]
pub async fn acp_cancel(
    connection_id: String,
    session_id: Option<String>,
    state: State<'_, AcpState>,
) -> Result<(), String> {
    state.cancel(&connection_id, session_id.as_deref()).await
}

#[tauri::command]
pub async fn acp_authenticate(
    connection_id: String,
    method_id: String,
    state: State<'_, AcpState>,
) -> Result<(), String> {
    state.authenticate(&connection_id, &method_id).await
}

#[tauri::command]
pub async fn acp_new_session(
    connection_id: String,
    cwd: String,
    state: State<'_, AcpState>,
) -> Result<Value, String> {
    state.new_session(&connection_id, &cwd).await
}

#[tauri::command]
pub async fn acp_load_session(
    connection_id: String,
    session_id: String,
    cwd: String,
    state: State<'_, AcpState>,
) -> Result<Value, String> {
    state.load_session(&connection_id, &session_id, &cwd).await
}

#[tauri::command]
pub async fn acp_list_sessions(
    cwd: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<AcpSessionRecord>, String> {
    codexia_acp::list_sessions(cwd.as_deref(), limit.unwrap_or(100))
}

/// The stored transcript: raw `session/update` payloads in arrival order.
#[tauri::command]
pub async fn acp_get_session(session_id: String) -> Result<Vec<Value>, String> {
    codexia_acp::get_updates(&session_id)
}

#[tauri::command]
pub async fn acp_delete_session(session_id: String) -> Result<(), String> {
    codexia_acp::delete_session(&session_id)
}

#[tauri::command]
pub async fn acp_set_mode(
    connection_id: String,
    session_id: Option<String>,
    mode_id: String,
    state: State<'_, AcpState>,
) -> Result<Value, String> {
    state.set_mode(&connection_id, session_id.as_deref(), &mode_id)
        .await
}

#[tauri::command]
pub async fn acp_set_model(
    connection_id: String,
    session_id: Option<String>,
    model_id: String,
    reasoning_effort: Option<String>,
    state: State<'_, AcpState>,
) -> Result<Value, String> {
    state
        .set_model(
            &connection_id,
            session_id.as_deref(),
            &model_id,
            reasoning_effort.as_deref(),
        )
        .await
}

#[tauri::command]
pub async fn acp_set_config_option(
    connection_id: String,
    session_id: Option<String>,
    config_id: String,
    value: Value,
    state: State<'_, AcpState>,
) -> Result<Value, String> {
    state.set_config_option(&connection_id, session_id.as_deref(), &config_id, &value)
        .await
}

#[tauri::command]
pub async fn acp_respond_permission(
    connection_id: String,
    request_id: String,
    option_id: Option<String>,
    state: State<'_, AcpState>,
) -> Result<(), String> {
    state.respond_permission(&connection_id, &request_id, option_id)
}

#[tauri::command]
pub async fn acp_stop(connection_id: String, state: State<'_, AcpState>) -> Result<(), String> {
    state.stop(&connection_id).await
}
