use codexia_automation::{
    AutomationHandle, AutomationInput, AutomationRunRecord, AutomationSchedule, AutomationTask,
    CwdMode, self as automation,
};
use tauri::State;

/// `None` when the scheduler failed to start, so commands report that instead of
/// failing to resolve their state.
pub type AutomationState = Option<AutomationHandle>;
type HandleState<'a> = State<'a, AutomationState>;

fn resolve<'a>(state: &'a HandleState<'a>) -> Result<&'a AutomationHandle, String> {
    state
        .inner()
        .as_ref()
        .ok_or_else(|| "automation runtime is not available".to_string())
}

#[tauri::command]
pub async fn list_automations(handle: HandleState<'_>) -> Result<Vec<AutomationTask>, String> {
    automation::list_automations(resolve(&handle)?).await
}

#[tauri::command]
pub async fn list_automation_runs(
    task_id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<AutomationRunRecord>, String> {
    automation::list_automation_runs(task_id, limit).await
}

#[tauri::command]
pub async fn create_automation(
    name: String,
    projects: Vec<String>,
    prompt: String,
    schedule: AutomationSchedule,
    agent: Option<String>,
    model_provider: Option<String>,
    model: Option<String>,
    cwd_mode: Option<CwdMode>,
    handle: HandleState<'_>,
) -> Result<AutomationTask, String> {
    automation::create_automation(
        resolve(&handle)?,
        AutomationInput {
            name,
            projects,
            prompt,
            schedule,
            agent,
            model_provider,
            model,
            cwd_mode,
        },
    )
    .await
}

#[tauri::command]
pub async fn update_automation(
    id: String,
    name: String,
    projects: Vec<String>,
    prompt: String,
    schedule: AutomationSchedule,
    agent: Option<String>,
    model_provider: Option<String>,
    model: Option<String>,
    cwd_mode: Option<CwdMode>,
    handle: HandleState<'_>,
) -> Result<AutomationTask, String> {
    automation::update_automation(
        resolve(&handle)?,
        id,
        AutomationInput {
            name,
            projects,
            prompt,
            schedule,
            agent,
            model_provider,
            model,
            cwd_mode,
        },
    )
    .await
}

#[tauri::command]
pub async fn set_automation_paused(
    id: String,
    paused: bool,
    handle: HandleState<'_>,
) -> Result<AutomationTask, String> {
    automation::set_automation_paused(resolve(&handle)?, id, paused).await
}

#[tauri::command]
pub async fn delete_automation(id: String, handle: HandleState<'_>) -> Result<(), String> {
    automation::delete_automation(resolve(&handle)?, id).await
}

#[tauri::command]
pub async fn run_automation_now(id: String, handle: HandleState<'_>) -> Result<(), String> {
    automation::run_automation_now(resolve(&handle)?, id).await
}
