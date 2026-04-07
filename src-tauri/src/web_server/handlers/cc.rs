use std::sync::Arc;
use super::to_error_response;
use super::types::{
    CcMcpAddParams, CcMcpGetParams, CcMcpListParams, CcMcpRemoveParams, CcMcpToggleParams,
    CcGetSessionsParams, CcNewSessionParams, CcResolvePermissionParams, CcResumeSessionParams,
    CcSendMessageParams, CcSessionIdParams, CcSetPermissionModeParams, CcUpdateSettingsParams,
};
use axum::{Json, extract::State as AxumState, http::StatusCode};
use serde_json::Value;
use crate::web_server::types::{ErrorResponse, WebServerState};

use crate::cc::mcp::{self as cc_mcp_commands, ClaudeCodeMcpServer, ClaudeCodeResponse};
use crate::cc::services::{
    message_service as cc_message_service, project_service as cc_project_service,
    session_service as cc_session_service, settings_service as cc_settings_service,
    skill_service as cc_skill_service,
};
use crate::cc::types::CCConnectParams;
use crate::cc::services::session_service::SessionListResult;

pub(crate) async fn api_cc_connect(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CCConnectParams>,
) -> Result<StatusCode, ErrorResponse> {
    cc_session_service::connect(params, state.cc_state.as_ref())
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_send_message(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CcSendMessageParams>,
) -> Result<StatusCode, ErrorResponse> {
    let sid = params.session_id.clone();
    let cc_state = Arc::clone(&state.cc_state);

    cc_message_service::send_message(
        &params.session_id,
        &params.message,
        &params.image_paths,
        state.cc_state.as_ref(),
        move |msg| match serde_json::to_value(msg) {
            Ok(mut payload) => {
                // Inject session_id into the payload so the frontend filter matches,
                // and emit under the plain "cc-message" event name (same as the Tauri command).
                if let Some(obj) = payload.as_object_mut() {
                    obj.entry("session_id")
                        .or_insert_with(|| serde_json::Value::String(sid.clone()));
                }
                cc_state.emit("cc-message", payload);
            }
            Err(err) => log::error!("Failed to serialize CC message event: {}", err),
        },
    )
    .await
    .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_disconnect(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CcSessionIdParams>,
) -> Result<StatusCode, ErrorResponse> {
    cc_session_service::disconnect(&params.session_id, state.cc_state.as_ref())
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_new_session(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CcNewSessionParams>,
) -> Result<Json<String>, ErrorResponse> {
    let session_id = cc_session_service::new_session_and_send(
        params.options,
        params.initial_message,
        state.cc_state.as_ref(),
    )
    .await
    .map_err(to_error_response)?;
    Ok(Json(session_id))
}

pub(crate) async fn api_cc_interrupt(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CcSessionIdParams>,
) -> Result<StatusCode, ErrorResponse> {
    cc_session_service::interrupt(&params.session_id, state.cc_state.as_ref())
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_resume_session(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CcResumeSessionParams>,
) -> Result<StatusCode, ErrorResponse> {
    cc_session_service::resume_session(
        params.session_id,
        params.options,
        state.cc_state.as_ref(),
    )
    .await
    .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_get_projects() -> Result<Json<Vec<String>>, ErrorResponse> {
    let projects = cc_project_service::get_projects().map_err(to_error_response)?;
    Ok(Json(projects))
}

pub(crate) async fn api_cc_get_installed_skills() -> Result<Json<Vec<String>>, ErrorResponse> {
    let skills = cc_skill_service::get_installed_skills().map_err(to_error_response)?;
    Ok(Json(skills))
}

pub(crate) async fn api_cc_get_slash_commands(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<String>>, ErrorResponse> {
    let cwd = params.get("cwd").map(|s| s.as_str());
    let commands = cc_skill_service::get_slash_commands(cwd).map_err(to_error_response)?;
    Ok(Json(commands))
}

pub(crate) async fn api_cc_get_settings() -> Result<Json<Value>, ErrorResponse> {
    let settings = cc_settings_service::get_settings().map_err(to_error_response)?;
    Ok(Json(settings))
}

pub(crate) async fn api_cc_update_settings(
    Json(params): Json<CcUpdateSettingsParams>,
) -> Result<StatusCode, ErrorResponse> {
    cc_settings_service::update_settings(params.settings).map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_list_sessions(
    axum::extract::Query(params): axum::extract::Query<CcGetSessionsParams>,
) -> Result<Json<SessionListResult>, ErrorResponse> {
    let result = cc_session_service::list_sessions(
        params.directory.as_deref(),
        params.limit,
        params.offset.unwrap_or(0),
        params.include_worktrees.unwrap_or(true),
    )
    .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_cc_delete_session(
    Json(params): Json<CcSessionIdParams>,
) -> Result<StatusCode, ErrorResponse> {
    claude_agent_sdk_rs::session_mutations::delete_session(&params.session_id, None)
        .map_err(to_error_response)?;
    crate::cc::db::SessionCache::new()
        .and_then(|cache| cache.delete_session(&params.session_id))
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_get_session_file_path(
    Json(params): Json<CcSessionIdParams>,
) -> Result<Json<Option<String>>, ErrorResponse> {
    Ok(Json(crate::cc::scan::find_session_file(&params.session_id)))
}

pub(crate) async fn api_cc_resolve_permission(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CcResolvePermissionParams>,
) -> Result<StatusCode, ErrorResponse> {
    state
        .cc_state
        .resolve_permission(&params.request_id, params.decision)
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_cc_set_permission_mode(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CcSetPermissionModeParams>,
) -> Result<StatusCode, ErrorResponse> {
    cc_session_service::set_permission_mode(
        &params.session_id,
        &params.mode,
        state.cc_state.as_ref(),
    )
    .await
    .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}
pub(crate) async fn api_cc_mcp_list(
    Json(params): Json<CcMcpListParams>,
) -> Result<Json<Vec<ClaudeCodeMcpServer>>, ErrorResponse> {
    let servers = cc_mcp_commands::cc_mcp_list(params.working_dir)
        .await
        .map_err(to_error_response)?;
    Ok(Json(servers))
}

pub(crate) async fn api_cc_mcp_get(
    Json(params): Json<CcMcpGetParams>,
) -> Result<Json<ClaudeCodeMcpServer>, ErrorResponse> {
    let server = cc_mcp_commands::cc_mcp_get(params.name, params.working_dir)
        .await
        .map_err(to_error_response)?;
    Ok(Json(server))
}

pub(crate) async fn api_cc_mcp_add(
    Json(params): Json<CcMcpAddParams>,
) -> Result<Json<ClaudeCodeResponse>, ErrorResponse> {
    let response = cc_mcp_commands::cc_mcp_add(params.request, params.working_dir)
        .await
        .map_err(to_error_response)?;
    Ok(Json(response))
}

pub(crate) async fn api_cc_mcp_remove(
    Json(params): Json<CcMcpRemoveParams>,
) -> Result<Json<ClaudeCodeResponse>, ErrorResponse> {
    let response = cc_mcp_commands::cc_mcp_remove(params.name, params.working_dir, params.scope)
        .await
        .map_err(to_error_response)?;
    Ok(Json(response))
}

pub(crate) async fn api_cc_list_projects() -> Result<Json<Vec<String>>, ErrorResponse> {
    let projects = cc_mcp_commands::cc_list_projects()
        .await
        .map_err(to_error_response)?;
    Ok(Json(projects))
}

pub(crate) async fn api_cc_mcp_disable(
    Json(params): Json<CcMcpToggleParams>,
) -> Result<Json<ClaudeCodeResponse>, ErrorResponse> {
    let response = cc_mcp_commands::cc_mcp_disable(params.name, params.working_dir)
        .await
        .map_err(to_error_response)?;
    Ok(Json(response))
}

pub(crate) async fn api_cc_mcp_enable(
    Json(params): Json<CcMcpToggleParams>,
) -> Result<Json<ClaudeCodeResponse>, ErrorResponse> {
    let response = cc_mcp_commands::cc_mcp_enable(params.name, params.working_dir)
        .await
        .map_err(to_error_response)?;
    Ok(Json(response))
}
