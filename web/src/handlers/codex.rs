use super::to_error_response;
use super::types::{
    ApprovalDecisionParams, McpElicitationResponseParams, PermissionsApprovalParams,
    UnifiedMcpAddParams, UnifiedMcpReadParams, UnifiedMcpRemoveParams,
    UnifiedMcpToggleParams, UserInputResponseParams,
};
use axum::{Json, extract::State as AxumState, http::StatusCode};
use serde_json::{Value, json};
use crate::types::{ErrorResponse, WebServerState};

use codexia_codex::AppState;
use codexia_cc::mcp_unified as mcp;

fn require_codex(state: &WebServerState) -> Result<&AppState, ErrorResponse> {
    state.codex_state.as_deref().ok_or_else(|| ErrorResponse {
        error: "codex backend is not available (codex binary not found in PATH)".to_string(),
    })
}

pub(crate) async fn api_start_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("thread/start", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_resume_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("thread/resume", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_fork_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("thread/fork", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_rollback_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("thread/rollback", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_list_threads(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("thread/list", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_archive_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("thread/archive", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_unarchive_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("thread/unarchive", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_turn_start(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("turn/start", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_turn_interrupt(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("turn/interrupt", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_model_list(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("model/list", json!({}))
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_model_list_post(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("model/list", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_account_rate_limits(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("account/rateLimits/read", Value::Null)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_get_account(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("account/read", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_login_account(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("account/login/start", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_skills_list(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("skills/list", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_skills_config_write(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("skills/config/write", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_respond_command_execution_approval(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ApprovalDecisionParams>,
) -> Result<StatusCode, ErrorResponse> {
    require_codex(&state)?
        .codex
        .send_response(params.request_id, json!({ "decision": params.decision }))
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_respond_file_change_approval(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ApprovalDecisionParams>,
) -> Result<StatusCode, ErrorResponse> {
    require_codex(&state)?
        .codex
        .send_response(params.request_id, json!({ "decision": params.decision }))
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_respond_user_input(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<UserInputResponseParams>,
) -> Result<StatusCode, ErrorResponse> {
    require_codex(&state)?
        .codex
        .send_response(params.request_id, params.response)
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_respond_mcp_elicitation(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<McpElicitationResponseParams>,
) -> Result<StatusCode, ErrorResponse> {
    require_codex(&state)?
        .codex
        .send_response(
            params.request_id,
            json!({
                "action": params.action,
                "content": params.content,
                "_meta": params.meta,
            }),
        )
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_respond_permissions_approval(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<PermissionsApprovalParams>,
) -> Result<StatusCode, ErrorResponse> {
    require_codex(&state)?
        .codex
        .send_response(
            params.request_id,
            json!({
                "permissions": params.permissions,
                "scope": params.scope,
                "strictAutoReview": params.strict_auto_review,
            }),
        )
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_start_review(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("review/start", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}
pub(crate) async fn api_unified_add_mcp_server(
    Json(params): Json<UnifiedMcpAddParams>,
) -> Result<StatusCode, ErrorResponse> {
    mcp::unified_add_mcp_server(
        params.client_name,
        params.path,
        params.server_name,
        params.server_config,
        params.scope,
    )
    .await
    .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_unified_remove_mcp_server(
    Json(params): Json<UnifiedMcpRemoveParams>,
) -> Result<StatusCode, ErrorResponse> {
    mcp::unified_remove_mcp_server(
        params.client_name,
        params.path,
        params.server_name,
        params.scope,
    )
    .await
    .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_unified_enable_mcp_server(
    Json(params): Json<UnifiedMcpToggleParams>,
) -> Result<StatusCode, ErrorResponse> {
    mcp::unified_enable_mcp_server(params.client_name, params.path, params.server_name)
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_unified_disable_mcp_server(
    Json(params): Json<UnifiedMcpToggleParams>,
) -> Result<StatusCode, ErrorResponse> {
    mcp::unified_disable_mcp_server(params.client_name, params.path, params.server_name)
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_unified_read_mcp_config(
    Json(params): Json<UnifiedMcpReadParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = mcp::unified_read_mcp_config(params.client_name, params.path)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_mcp_server_oauth_login(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("mcpServer/oauth/login", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_list_mcp_server_status(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<Value>,
) -> Result<Json<Value>, ErrorResponse> {
    let result = require_codex(&state)?
        .codex
        .send_request("mcpServerStatus/list", params)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}
