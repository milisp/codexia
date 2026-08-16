use super::to_error_response;
use axum::Json;
use serde::Deserialize;

use codexia_shared::openapp::{check_app_installed, open_workspace_in, AppStatus, OpenWorkspaceOptions};

use crate::types::ErrorResponse;

#[derive(Deserialize)]
pub(crate) struct CheckAppInstalledParams {
    #[serde(rename = "appName")]
    app_name: String,
}

#[derive(Deserialize)]
pub(crate) struct OpenWorkspaceInParams {
    path: String,
    options: OpenWorkspaceOptions,
}

pub(crate) async fn api_check_app_installed(
    Json(params): Json<CheckAppInstalledParams>,
) -> Result<Json<AppStatus>, ErrorResponse> {
    let status = check_app_installed(params.app_name)
        .await
        .map_err(to_error_response)?;
    Ok(Json(status))
}

pub(crate) async fn api_open_workspace_in(
    Json(params): Json<OpenWorkspaceInParams>,
) -> Result<(), ErrorResponse> {
    open_workspace_in(params.path, params.options)
        .await
        .map_err(to_error_response)
}
