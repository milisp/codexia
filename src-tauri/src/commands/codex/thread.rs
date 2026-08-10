use serde_json::{Value, json};
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn start_thread(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/start", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn resume_thread(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/resume", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn fork_thread(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("thread/fork", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn rollback_thread(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("thread/rollback", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn list_threads(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("thread/list", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn archive_thread(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = json!({
        "threadId": thread_id
    });
    let result = state.codex.send_request("thread/archive", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn unarchive_thread(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = json!({
        "threadId": thread_id
    });
    let result = state.codex.send_request("thread/unarchive", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn delete_thread(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = json!({
        "threadId": thread_id
    });
    let result = state.codex.send_request("thread/delete", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn rename_thread(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state.codex.send_request("thread/name/set", params).await?;
    Ok(result)
}