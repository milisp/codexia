use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn get_account(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("account/read", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn login_account(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("account/login/start", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn account_rate_limits(
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("account/rateLimits/read", Value::Null)
        .await?;
    Ok(result)
}