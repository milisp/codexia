use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn thread_goal_set(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/goal/set", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn thread_goal_get(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/goal/get", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn thread_goal_clear(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/goal/clear", params)
        .await?;
    Ok(result)
}