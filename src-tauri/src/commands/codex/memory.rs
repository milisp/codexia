use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

#[tauri::command]
pub async fn thread_compact_start(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/compact/start", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn thread_memory_mode_set(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/memoryMode/set", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn memory_reset(params: Value, state: State<'_, AppState>) -> Result<Value, String> {
    let result = state.codex.send_request("memory/reset", params).await?;
    Ok(result)
}
