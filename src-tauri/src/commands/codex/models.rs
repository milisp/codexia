use codex_app_server_protocol::{
    ModelListResponse,
};
use serde_json::json;
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::from_value;

#[tauri::command]
pub async fn list_other_models() -> Result<Vec<codexia_codex::providers::FrontendProviderModels>, String> {
    codexia_codex::providers::load_and_fetch_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_env_keys() -> Result<Vec<codexia_codex::providers::EnvStatusItem>, String> {
    codexia_codex::providers::load_env_keys().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn model_list(state: State<'_, AppState>) -> Result<ModelListResponse, String> {
    let params = json!({});
    let result = state.codex.send_request("model/list", params).await?;
    Ok(from_value(result)?)
}