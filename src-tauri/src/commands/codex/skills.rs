use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn skills_list(
    cwd: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = serde_json::json!({
        "cwds": [cwd]
    });
    let result = state.codex.send_request("skills/list", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn skills_config_write(
    path: String,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = serde_json::json!({
        "path": path,
        "enabled": enabled
    });
    let result = state
        .codex
        .send_request("skills/config/write", params)
        .await?;
    Ok(result)
}