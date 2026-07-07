use codex_app_server_protocol::{
    CommandExecutionApprovalDecision, CommandExecutionRequestApprovalResponse,
    FileChangeApprovalDecision, FileChangeRequestApprovalResponse, RequestId,
};
use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::to_value;

#[tauri::command]
pub async fn respond_to_command_execution_approval(
    request_id: RequestId,
    decision: CommandExecutionApprovalDecision,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let result_value = to_value(CommandExecutionRequestApprovalResponse { decision })?;
    println!(
        "codex:response: {}",
        serde_json::to_string(&result_value).unwrap_or_default()
    );
    state.codex.send_response(request_id, result_value).await?;
    Ok(())
}

#[tauri::command]
pub async fn respond_to_file_change_approval(
    request_id: RequestId,
    decision: FileChangeApprovalDecision,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let result_value = to_value(FileChangeRequestApprovalResponse { decision })?;
    println!(
        "codex:response: {}",
        serde_json::to_string(&result_value).unwrap_or_default()
    );
    state.codex.send_response(request_id, result_value).await?;
    Ok(())
}

#[tauri::command]
pub async fn respond_to_request_user_input(
    request_id: RequestId,
    response: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(
        "codex:response: {}",
        serde_json::to_string(&response).unwrap_or_default()
    );
    state.codex.send_response(request_id, response).await?;
    Ok(())
}