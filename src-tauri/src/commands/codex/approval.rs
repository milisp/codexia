use codexia_codex::protocol::RequestId;
use serde_json::{Value, json};
use tauri::State;

use codexia_codex::AppState;

async fn send_approval(
    state: &State<'_, AppState>,
    request_id: RequestId,
    result: Value,
) -> Result<(), String> {
    println!(
        "codex:response: {}",
        serde_json::to_string(&result).unwrap_or_default()
    );
    state.codex.send_response(request_id, result).await
}

#[tauri::command]
pub async fn respond_to_command_execution_approval(
    request_id: RequestId,
    decision: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    send_approval(&state, request_id, json!({ "decision": decision })).await
}

#[tauri::command]
pub async fn respond_to_file_change_approval(
    request_id: RequestId,
    decision: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    send_approval(&state, request_id, json!({ "decision": decision })).await
}

#[tauri::command]
pub async fn respond_to_request_user_input(
    request_id: RequestId,
    response: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    send_approval(&state, request_id, response).await
}
