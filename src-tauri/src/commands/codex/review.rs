use codex_app_server_protocol::{
    ReviewStartParams, ReviewStartResponse,
};
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::{to_value, from_value};

#[tauri::command]
pub async fn start_review(
    params: ReviewStartParams,
    state: State<'_, AppState>,
) -> Result<ReviewStartResponse, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("review/start", params_value)
        .await?;
    Ok(from_value(result)?)
}