use codex_app_server_protocol::{
    ThreadForkParams, ThreadListParams,
    ThreadRollbackParams, ThreadResumeParams, ThreadSetNameParams, ThreadStartParams,
};
use serde_json::{Value, json};
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::{to_value, from_value};

#[tauri::command]
pub async fn start_thread(
    params: ThreadStartParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/start", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn resume_thread(
    params: ThreadResumeParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/resume", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn fork_thread(
    params: ThreadForkParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("thread/fork", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn rollback_thread(
    params: ThreadRollbackParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/rollback", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn list_threads(
    params: ThreadListParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("thread/list", params_value).await?;
    Ok(from_value(result)?)
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
    Ok(from_value(result)?)
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
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn rename_thread(
    params: ThreadSetNameParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("thread/name/set", params_value).await?;
    Ok(from_value(result)?)
}