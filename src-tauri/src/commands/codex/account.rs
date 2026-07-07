use codex_app_server_protocol::{
    GetAccountParams, GetAccountRateLimitsResponse, GetAccountResponse,
    LoginAccountParams, LoginAccountResponse,
};
use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::{to_value, from_value};

#[tauri::command]
pub async fn get_account(
    params: GetAccountParams,
    state: State<'_, AppState>,
) -> Result<GetAccountResponse, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("account/read", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn login_account(
    params: LoginAccountParams,
    state: State<'_, AppState>,
) -> Result<LoginAccountResponse, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("account/login/start", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn account_rate_limits(
    state: State<'_, AppState>,
) -> Result<GetAccountRateLimitsResponse, String> {
    let result = state
        .codex
        .send_request("account/rateLimits/read", Value::Null)
        .await?;
    Ok(from_value(result)?)
}