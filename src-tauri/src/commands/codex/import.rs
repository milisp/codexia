use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

#[tauri::command]
pub async fn external_agent_config_detect(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("externalAgentConfig/detect", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn external_agent_config_import(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("externalAgentConfig/import", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn external_agent_config_import_record_history(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("externalAgentConfig/import/recordHistory", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn external_agent_config_import_read_histories(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("externalAgentConfig/import/readHistories", params)
        .await?;
    Ok(result)
}
