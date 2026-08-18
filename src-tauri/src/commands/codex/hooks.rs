use serde_json::Value;
use tauri::State;

use codexia_codex::AppState;

#[tauri::command]
pub async fn hooks_list(params: Value, state: State<'_, AppState>) -> Result<Value, String> {
    let result = state.codex.send_request("hooks/list", params).await?;
    Ok(result)
}
