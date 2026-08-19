use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;
use codexia_codex::accounts::{self, AccountSummary};


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

/// Saves the currently signed-in account (CODEX_HOME/auth.json) as a named
/// snapshot so it can be switched back to later without logging out.
#[tauri::command]
pub async fn save_account_snapshot(
    label: String,
    email: Option<String>,
    plan_type: Option<String>,
) -> Result<(), String> {
    accounts::save_current_account(&label, email, plan_type)
}

#[tauri::command]
pub async fn list_account_snapshots() -> Result<Vec<AccountSummary>, String> {
    accounts::list_accounts()
}

#[tauri::command]
pub async fn remove_account_snapshot(label: String) -> Result<(), String> {
    accounts::remove_account(&label)
}

#[tauri::command]
pub async fn switch_account_snapshot(
    label: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    accounts::switch_account(&label, &state.codex).await
}