use super::to_error_response;
use super::types::{
    CreateAutomationParams, DeleteAutomationParams, ListAutomationRunsParams,
    RunAutomationNowParams, SetAutomationPausedParams, UpdateAutomationParams,
};
use axum::{Json, extract::State as AxumState, http::StatusCode};

use crate::types::{ErrorResponse, WebServerState};
use codexia_automation::{
    AutomationInput, AutomationRunRecord, AutomationTask, create_automation, delete_automation,
    list_automations, run_automation_now, set_automation_paused, update_automation,
};

fn handle(state: &WebServerState) -> Result<&codexia_automation::AutomationHandle, ErrorResponse> {
    state
        .automation
        .as_ref()
        .ok_or_else(|| to_error_response("automation runtime is not available".to_string()))
}

pub(crate) async fn api_list_automations(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<Vec<AutomationTask>>, ErrorResponse> {
    let tasks = list_automations(handle(&state)?)
        .await
        .map_err(to_error_response)?;
    Ok(Json(tasks))
}

pub(crate) async fn api_list_automation_runs(
    Json(params): Json<ListAutomationRunsParams>,
) -> Result<Json<Vec<AutomationRunRecord>>, ErrorResponse> {
    let runs = codexia_automation::list_automation_runs(params.task_id, params.limit)
        .await
        .map_err(to_error_response)?;
    Ok(Json(runs))
}

pub(crate) async fn api_create_automation(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<CreateAutomationParams>,
) -> Result<Json<AutomationTask>, ErrorResponse> {
    let task = create_automation(
        handle(&state)?,
        AutomationInput {
            name: params.name,
            projects: params.projects,
            prompt: params.prompt,
            schedule: params.schedule,
            agent: params.agent,
            model_provider: params.model_provider,
            model: params.model,
            cwd_mode: params.cwd_mode,
        },
    )
    .await
    .map_err(to_error_response)?;
    Ok(Json(task))
}

pub(crate) async fn api_set_automation_paused(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<SetAutomationPausedParams>,
) -> Result<Json<AutomationTask>, ErrorResponse> {
    let task = set_automation_paused(handle(&state)?, params.id, params.paused)
        .await
        .map_err(to_error_response)?;
    Ok(Json(task))
}

pub(crate) async fn api_update_automation(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<UpdateAutomationParams>,
) -> Result<Json<AutomationTask>, ErrorResponse> {
    let task = update_automation(
        handle(&state)?,
        params.id,
        AutomationInput {
            name: params.name,
            projects: params.projects,
            prompt: params.prompt,
            schedule: params.schedule,
            agent: params.agent,
            model_provider: params.model_provider,
            model: params.model,
            cwd_mode: params.cwd_mode,
        },
    )
    .await
    .map_err(to_error_response)?;
    Ok(Json(task))
}

pub(crate) async fn api_delete_automation(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<DeleteAutomationParams>,
) -> Result<StatusCode, ErrorResponse> {
    delete_automation(handle(&state)?, params.id)
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}

pub(crate) async fn api_run_automation_now(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<RunAutomationNowParams>,
) -> Result<StatusCode, ErrorResponse> {
    run_automation_now(handle(&state)?, params.id)
        .await
        .map_err(to_error_response)?;
    Ok(StatusCode::OK)
}
