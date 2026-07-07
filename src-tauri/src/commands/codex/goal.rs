use codex_app_server_protocol::{
    ThreadGoalClearParams, ThreadGoalGetParams, ThreadGoalSetParams,
};
use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::{to_value, from_value};

#[tauri::command]
pub async fn thread_goal_set(
    params: ThreadGoalSetParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/goal/set", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn thread_goal_get(
    params: ThreadGoalGetParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/goal/get", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn thread_goal_clear(
    params: ThreadGoalClearParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/goal/clear", params_value)
        .await?;
    Ok(from_value(result)?)
}