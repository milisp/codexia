use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn start_review(
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let result = state
        .codex
        .send_request("review/start", params)
        .await?;
    Ok(result)
}