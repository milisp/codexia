use super::to_error_response;
use super::types::{
    CommandExecutionApprovalParams, FileChangeApprovalParams, ListThreadsRequest,
    UnifiedMcpAddParams, UnifiedMcpReadParams, UnifiedMcpRemoveParams, UnifiedMcpToggleParams,
    UserInputResponseParams,
};
use axum::{Json, extract::State as AxumState, http::StatusCode};
use codex_app_server_protocol::{
    GetAccountParams, LoginAccountParams, ModelListParams,
    ReviewStartParams, SkillsConfigWriteParams, SkillsListParams, ThreadArchiveParams,
    ThreadForkParams, ThreadListParams, ThreadResumeParams, ThreadRollbackParams,
    ThreadStartParams, TurnInterruptParams, TurnStartParams,
};
use serde_json::{Value, json};
use crate::web_server::types::{ErrorResponse, WebServerState};

use crate::codex::scan::{list_archived_threads_payload, list_threads_payload};
use crate::codex::AppState;
use crate::features::mcp;

fn require_codex(state: &WebServerState) -> Result<&AppState, ErrorResponse> {
    state.codex_state.as_deref().ok_or_else(|| ErrorResponse {
        error: "codex backend is not available (codex binary not found in PATH)".to_string(),
    })
}

pub(crate) async fn api_start_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ThreadStartParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("thread/start", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_resume_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ThreadResumeParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("thread/resume", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_fork_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ThreadForkParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("thread/fork", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_rollback_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ThreadRollbackParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("thread/rollback", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_list_threads(
    AxumState(_state): AxumState<WebServerState>,
    Json(request): Json<ListThreadsRequest>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(request.params).map_err(to_error_response)?;
    let result =
        list_threads_payload(params_value, request.cwd.as_deref()).map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_list_archived_threads(
    AxumState(_state): AxumState<WebServerState>,
    Json(params): Json<ThreadListParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = list_archived_threads_payload(params_value).map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_archive_thread(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ThreadArchiveParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("thread/archive", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_turn_start(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<TurnStartParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("turn/start", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_turn_interrupt(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<TurnInterruptParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("turn/interrupt", params_value)
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
    Json(params): Json<ModelListParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("model/list", params_value)
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
    Json(params): Json<GetAccountParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("account/read", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_login_account(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<LoginAccountParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("account/login/start", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_skills_list(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<SkillsListParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("skills/list", params_value)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_skills_config_write(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<SkillsConfigWriteParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let payload = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("skills/config/write", payload)
        .await
        .map_err(to_error_response)?;
    Ok(Json(result))
}

pub(crate) async fn api_respond_command_execution_approval(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CommandExecutionApprovalParams>,
) -> Result<StatusCode, ErrorResponse> {
    let result_value = serde_json::to_value(
        codex_app_server_protocol::CommandExecutionRequestApprovalResponse {
            decision: params.decision,
        },
    )
    .map_err(to_error_response)?;

    require_codex(&state)?
        .codex
        .send_response(params.request_id, result_value)
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_respond_file_change_approval(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<FileChangeApprovalParams>,
) -> Result<StatusCode, ErrorResponse> {
    let result_value = serde_json::to_value(
        codex_app_server_protocol::FileChangeRequestApprovalResponse {
            decision: params.decision,
        },
    )
    .map_err(to_error_response)?;

    require_codex(&state)?
        .codex
        .send_response(params.request_id, result_value)
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_respond_user_input(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<UserInputResponseParams>,
) -> Result<StatusCode, ErrorResponse> {
    let result_value = serde_json::to_value(params.response).map_err(to_error_response)?;

    require_codex(&state)?
        .codex
        .send_response(params.request_id, result_value)
        .await
        .map_err(to_error_response)?;

    Ok(StatusCode::OK)
}

pub(crate) async fn api_start_review(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<ReviewStartParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let params_value = serde_json::to_value(params).map_err(to_error_response)?;
    let result = require_codex(&state)?
        .codex
        .send_request("review/start", params_value)
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
