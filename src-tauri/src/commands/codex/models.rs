use serde_json::{Value, json};
use tauri::State;

use codexia_codex::AppState;


#[tauri::command]
pub async fn list_other_models() -> Result<Vec<codexia_codex::providers::FrontendProviderModels>, String> {
    codexia_codex::providers::load_and_fetch_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_env_keys() -> Result<Vec<codexia_codex::providers::EnvStatusItem>, String> {
    codexia_codex::providers::load_env_keys().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn model_list(state: State<'_, AppState>) -> Result<Value, String> {
    let params = json!({});
    let result = state.codex.send_request("model/list", params).await?;
    Ok(result)
}