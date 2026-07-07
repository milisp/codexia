use codex_app_server_protocol::{
    TurnInterruptParams, TurnStartParams, TurnSteerParams,
};
use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::{to_value, from_value};

#[tauri::command]
pub async fn turn_start(
    params: TurnStartParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("turn/start", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn turn_steer(
    params: TurnSteerParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("turn/steer", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn turn_interrupt(
    params: TurnInterruptParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("turn/interrupt", params_value)
        .await?;
    Ok(from_value(result)?)
}