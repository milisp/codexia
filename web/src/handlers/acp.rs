use axum::{Json, extract::State as AxumState, http::StatusCode};
use codexia_acp::{AcpAgentDef, AcpSessionRecord, AcpStartResult};
use serde::Deserialize;
use serde_json::Value;

use crate::types::{ErrorResponse, WebServerState};

#[derive(Deserialize)]
pub(crate) struct AcpStartParams {
    pub agent_id: String,
    pub cwd: String,
    #[serde(default)]
    pub custom: Option<AcpAgentDef>,
}

#[derive(Deserialize)]
pub(crate) struct AcpPromptParams {
    pub connection_id: String,
    pub text: String,
}

#[derive(Deserialize)]
pub(crate) struct AcpConnectionParams {
    pub connection_id: String,
}

#[derive(Deserialize)]
pub(crate) struct AcpAuthParams {
    pub connection_id: String,
    pub method_id: String,
}

#[derive(Deserialize)]
pub(crate) struct AcpNewSessionParams {
    pub connection_id: String,
    pub cwd: String,
}

#[derive(Deserialize)]
pub(crate) struct AcpLoadSessionParams {
    pub connection_id: String,
    pub session_id: String,
    pub cwd: String,
}

#[derive(Deserialize)]
pub(crate) struct AcpListSessionsParams {
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub(crate) struct AcpSessionParams {
    pub session_id: String,
}

#[derive(Deserialize)]
pub(crate) struct AcpSetModeParams {
    pub connection_id: String,
    pub mode_id: String,
}

#[derive(Deserialize)]
pub(crate) struct AcpSetModelParams {
    pub connection_id: String,
    pub model_id: String,
    #[serde(default)]
    pub reasoning_effort: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct AcpSetConfigOptionParams {
    pub connection_id: String,
    pub config_id: String,
    pub value: Value,
}

#[derive(Deserialize)]
pub(crate) struct AcpPermissionParams {
    pub connection_id: String,
    pub request_id: String,
    #[serde(default)]
    pub option_id: Option<String>,
}

fn err(e: String) -> ErrorResponse {
    ErrorResponse { error: e }
}

pub(crate) async fn api_acp_list_agents() -> Json<Vec<AcpAgentDef>> {
    Json(codexia_acp::list_agents())
}

pub(crate) async fn api_acp_start(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpStartParams>,
) -> Result<Json<AcpStartResult>, ErrorResponse> {
    state
        .acp_state
        .start(&params.agent_id, &params.cwd, params.custom)
        .await
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_prompt(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpPromptParams>,
) -> Result<Json<Value>, ErrorResponse> {
    state
        .acp_state
        .prompt(&params.connection_id, &params.text)
        .await
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_cancel(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpConnectionParams>,
) -> Result<StatusCode, ErrorResponse> {
    state
        .acp_state
        .cancel(&params.connection_id)
        .await
        .map_err(err)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_acp_authenticate(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpAuthParams>,
) -> Result<StatusCode, ErrorResponse> {
    state
        .acp_state
        .authenticate(&params.connection_id, &params.method_id)
        .await
        .map_err(err)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_acp_new_session(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpNewSessionParams>,
) -> Result<Json<Value>, ErrorResponse> {
    state
        .acp_state
        .new_session(&params.connection_id, &params.cwd)
        .await
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_load_session(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpLoadSessionParams>,
) -> Result<Json<Value>, ErrorResponse> {
    state
        .acp_state
        .load_session(&params.connection_id, &params.session_id, &params.cwd)
        .await
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_list_sessions(
    Json(params): Json<AcpListSessionsParams>,
) -> Result<Json<Vec<AcpSessionRecord>>, ErrorResponse> {
    codexia_acp::list_sessions(params.cwd.as_deref(), params.limit.unwrap_or(100))
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_get_session(
    Json(params): Json<AcpSessionParams>,
) -> Result<Json<Vec<Value>>, ErrorResponse> {
    codexia_acp::get_updates(&params.session_id)
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_delete_session(
    Json(params): Json<AcpSessionParams>,
) -> Result<StatusCode, ErrorResponse> {
    codexia_acp::delete_session(&params.session_id).map_err(err)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_acp_set_mode(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpSetModeParams>,
) -> Result<Json<Value>, ErrorResponse> {
    state
        .acp_state
        .set_mode(&params.connection_id, &params.mode_id)
        .await
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_set_model(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpSetModelParams>,
) -> Result<Json<Value>, ErrorResponse> {
    state
        .acp_state
        .set_model(
            &params.connection_id,
            &params.model_id,
            params.reasoning_effort.as_deref(),
        )
        .await
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_set_config_option(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpSetConfigOptionParams>,
) -> Result<Json<Value>, ErrorResponse> {
    state
        .acp_state
        .set_config_option(&params.connection_id, &params.config_id, &params.value)
        .await
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_acp_respond_permission(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpPermissionParams>,
) -> Result<StatusCode, ErrorResponse> {
    state
        .acp_state
        .respond_permission(&params.connection_id, &params.request_id, params.option_id)
        .map_err(err)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_acp_stop(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<AcpConnectionParams>,
) -> Result<StatusCode, ErrorResponse> {
    state
        .acp_state
        .stop(&params.connection_id)
        .await
        .map_err(err)?;
    Ok(StatusCode::OK)
}
