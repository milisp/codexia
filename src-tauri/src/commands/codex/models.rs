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
pub async fn list_provider_presets()
-> Result<Vec<codexia_codex::providers::ProviderConfig>, String> {
    codexia_codex::providers::list_provider_presets()
}

/// Persist a user-added provider into the Codex `config.toml`.
#[tauri::command]
pub async fn add_model_provider(
    state: State<'_, AppState>,
    provider: String,
    base_url: String,
    env_key: String,
) -> Result<(), String> {
    codexia_codex::config::provider::write_model_provider(
        &state.codex,
        &provider,
        &base_url,
        &env_key,
    )
    .await
}

/// Providers present in the user's config.toml.
#[tauri::command]
pub async fn list_config_providers(
    state: State<'_, AppState>,
) -> Result<Vec<codexia_codex::config::provider::ConfigProvider>, String> {
    codexia_codex::config::provider::read_model_providers(&state.codex).await
}

#[tauri::command]
pub async fn remove_model_provider(provider: String) -> Result<(), String> {
    codexia_codex::config::provider::remove_model_provider(&provider)
}

#[tauri::command]
pub async fn model_list(state: State<'_, AppState>) -> Result<Value, String> {
    let params = json!({});
    let result = state.codex.send_request("model/list", params).await?;
    Ok(result)
}