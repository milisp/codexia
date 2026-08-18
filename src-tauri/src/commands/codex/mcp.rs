use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

#[tauri::command]
pub async fn mcp_server_oauth_login(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("mcpServer/oauth/login", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn list_mcp_server_status(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("mcpServerStatus/list", params)
        .await?;
    Ok(result)
}
