use axum::{Json, extract::State as AxumState, http::StatusCode, response::IntoResponse};
use serde_json::json;

use super::types::{ErrorResponse, WebServerState};

mod cc;
mod codex;
mod dxt;
mod file;
mod git;
mod note;
mod automation;
mod insights;
mod skills;
mod settings;
mod skillssh;
mod terminal;
mod types;

pub(super) use cc::*;
pub(super) use codex::*;
pub(super) use dxt::*;
pub(super) use file::*;
pub(super) use git::*;
pub(super) use note::*;
pub(super) use automation::*;
pub(super) use insights::*;
pub(super) use skills::*;
pub(super) use settings::*;
pub(super) use skillssh::*;
pub(super) use terminal::*;
pub(super) use types::*;

pub(super) async fn api_prevent_sleep(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<SleepParams>,
) -> Result<StatusCode, ErrorResponse> {
    state
        .sleep_state
        .prevent_sleep(params.conversation_id)
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(super) async fn api_allow_sleep(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<SleepParams>,
) -> Result<StatusCode, ErrorResponse> {
    state
        .sleep_state
        .allow_sleep(params.conversation_id)
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(super) async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "ok"
    }))
}

fn to_error_response(err: impl ToString) -> ErrorResponse {
    ErrorResponse {
        error: err.to_string(),
    }
}
