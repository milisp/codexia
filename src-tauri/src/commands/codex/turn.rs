use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn turn_start(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("turn/start", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn turn_steer(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("turn/steer", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn turn_interrupt(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("turn/interrupt", params)
        .await?;
    Ok(result)
}