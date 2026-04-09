use axum::{Json, http::StatusCode};
use serde_json::Value;

use crate::web_server::types::ErrorResponse;
use super::to_error_response;

fn settings_path() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    Ok(home.join(".codexia").join("settings.json"))
}

pub(crate) async fn api_get_settings_file() -> Result<Json<Value>, ErrorResponse> {
    let path = settings_path().map_err(to_error_response)?;
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| to_error_response(e.to_string()))?;
    let json: Value = serde_json::from_str(&content)
        .map_err(|e| to_error_response(e.to_string()))?;
    Ok(Json(json))
}

pub(crate) async fn api_save_settings_file(
    Json(body): Json<Value>,
) -> Result<StatusCode, ErrorResponse> {
    let path = settings_path().map_err(to_error_response)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| to_error_response(e.to_string()))?;
    }
    let content = serde_json::to_string_pretty(&body)
        .map_err(|e| to_error_response(e.to_string()))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| to_error_response(e.to_string()))?;
    Ok(StatusCode::OK)
}
