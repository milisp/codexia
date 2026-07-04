use codex_app_server_protocol::{
    CommandExecutionApprovalDecision, CommandExecutionRequestApprovalResponse,
    FileChangeApprovalDecision, FileChangeRequestApprovalResponse, GetAccountParams,
    GetAccountRateLimitsResponse, GetAccountResponse,
    LoginAccountParams, LoginAccountResponse, ModelListResponse, RequestId, ReviewStartParams,
    ReviewStartResponse, SkillsListResponse, ThreadForkParams, ThreadListParams,
    ThreadSetNameParams, ThreadResumeParams, ThreadRollbackParams, ThreadStartParams, TurnInterruptParams,
    TurnStartParams, TurnSteerParams,
    ThreadGoalSetParams, ThreadGoalGetParams, ThreadGoalClearParams,
};
use serde_json::Value;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use tauri::State;

use codexia_codex::{AppState, CodexInitializationState, initialize_codex};

fn to_value<T: serde::Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|e| e.to_string())
}

fn from_value<T: serde::de::DeserializeOwned>(value: Value) -> Result<T, String> {
    serde_json::from_value(value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn codex_home() -> PathBuf {
    codexia_codex::utils::codex_home()
}

#[tauri::command]
pub async fn list_other_models() -> Result<Vec<codexia_codex::providers::FrontendProviderModels>, String> {
    codexia_codex::providers::load_and_fetch_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_env_keys() -> Result<Vec<codexia_codex::providers::EnvStatusItem>, String> {
    codexia_codex::providers::load_env_keys().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn initialize_codex_async(
    state: State<'_, AppState>,
    init_state: State<'_, CodexInitializationState>,
    cc_state: State<'_, codexia_cc::CCState>,
) -> Result<(), String> {
    if init_state.initialized.load(Ordering::SeqCst) {
        return Ok(());
    }

    let _guard = init_state.init_lock.lock().await;

    if init_state.initialized.load(Ordering::SeqCst) {
        return Ok(());
    }

    initialize_codex(&state.codex, Arc::clone(&init_state.event_sink)).await?;

    codexia_cc::automation::initialize_automation_runtime(
        Some(state.codex.clone()),
        cc_state.inner().clone(),
        Arc::clone(&init_state.event_sink),
    )
    .await?;

    init_state.initialized.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn start_thread(
    params: ThreadStartParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/start", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn resume_thread(
    params: ThreadResumeParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/resume", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn fork_thread(
    params: ThreadForkParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("thread/fork", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn rollback_thread(
    params: ThreadRollbackParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/rollback", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn list_threads(
    params: ThreadListParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("thread/list", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn archive_thread(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = json!({
        "threadId": thread_id
    });
    let result = state.codex.send_request("thread/archive", params).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn delete_thread(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = json!({
        "threadId": thread_id
    });
    let result = state.codex.send_request("thread/delete", params).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn rename_thread(
    params: ThreadSetNameParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("thread/name/set", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn turn_start(
    params: TurnStartParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("turn/start", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn turn_steer(
    params: TurnSteerParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("turn/steer", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn turn_interrupt(
    params: TurnInterruptParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("turn/interrupt", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn model_list(state: State<'_, AppState>) -> Result<ModelListResponse, String> {
    let params = json!({});
    let result = state.codex.send_request("model/list", params).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn account_rate_limits(
    state: State<'_, AppState>,
) -> Result<GetAccountRateLimitsResponse, String> {
    let result = state
        .codex
        .send_request("account/rateLimits/read", Value::Null)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn skills_list(
    cwd: String,
    state: State<'_, AppState>,
) -> Result<SkillsListResponse, String> {
    let params = json!({
        "cwds": [cwd]
    });
    let result = state.codex.send_request("skills/list", params).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn skills_config_write(
    path: String,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params = json!({
        "path": path,
        "enabled": enabled
    });
    let result = state
        .codex
        .send_request("skills/config/write", params)
        .await?;
    Ok(result)
}

#[tauri::command]
pub async fn respond_to_command_execution_approval(
    request_id: RequestId,
    decision: CommandExecutionApprovalDecision,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let result_value = to_value(CommandExecutionRequestApprovalResponse { decision })?;
    println!(
        "codex:response: {}",
        serde_json::to_string(&result_value).unwrap_or_default()
    );
    state.codex.send_response(request_id, result_value).await?;
    Ok(())
}

#[tauri::command]
pub async fn respond_to_file_change_approval(
    request_id: RequestId,
    decision: FileChangeApprovalDecision,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let result_value = to_value(FileChangeRequestApprovalResponse { decision })?;
    println!(
        "codex:response: {}",
        serde_json::to_string(&result_value).unwrap_or_default()
    );
    state.codex.send_response(request_id, result_value).await?;
    Ok(())
}

#[tauri::command]
pub async fn respond_to_request_user_input(
    request_id: RequestId,
    response: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(
        "codex:response: {}",
        serde_json::to_string(&response).unwrap_or_default()
    );
    state.codex.send_response(request_id, response).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_account(
    params: GetAccountParams,
    state: State<'_, AppState>,
) -> Result<GetAccountResponse, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("account/read", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn login_account(
    params: LoginAccountParams,
    state: State<'_, AppState>,
) -> Result<LoginAccountResponse, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("account/login/start", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn start_review(
    params: ReviewStartParams,
    state: State<'_, AppState>,
) -> Result<ReviewStartResponse, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("review/start", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn thread_goal_set(
    params: ThreadGoalSetParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/goal/set", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn thread_goal_get(
    params: ThreadGoalGetParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/goal/get", params_value)
        .await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn thread_goal_clear(
    params: ThreadGoalClearParams,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let params_value = to_value(params)?;
    let result = state
        .codex
        .send_request("thread/goal/clear", params_value)
        .await?;
    Ok(from_value(result)?)
}
