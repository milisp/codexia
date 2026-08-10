use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn plugin_list(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("plugin/list", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn plugin_read(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("plugin/read", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn plugin_install(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("plugin/install", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn plugin_uninstall(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("plugin/uninstall", params).await?;
    Ok(result)
}