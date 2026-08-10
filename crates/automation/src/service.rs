use chrono::Utc;
use uuid::Uuid;

use codexia_db::automation_runs;

use super::AutomationRunRecord;
use super::execution::execute_task;
use super::model::{
    AutomationSchedule, AutomationTask, CwdMode, default_model, default_model_provider,
    normalize_agent, or_default,
};
use super::runtime::{AutomationHandle, save_store, schedule_task};
use super::schedule::schedule_to_cron;

/// Fields a caller may set on a task. `None` means "use the default".
pub struct AutomationInput {
    pub name: String,
    pub projects: Vec<String>,
    pub prompt: String,
    pub schedule: AutomationSchedule,
    pub agent: Option<String>,
    pub model_provider: Option<String>,
    pub model: Option<String>,
    pub cwd_mode: Option<CwdMode>,
}

struct NormalizedInput {
    name: String,
    projects: Vec<String>,
    prompt: String,
    schedule: AutomationSchedule,
    cron_expression: String,
    agent: String,
    model_provider: String,
    model: String,
    cwd_mode: CwdMode,
}

fn normalize(input: AutomationInput, known_agents: &[String]) -> Result<NormalizedInput, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("name is required".to_string());
    }

    let prompt = input.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("prompt is required".to_string());
    }

    let cron_expression = schedule_to_cron(&input.schedule)?;

    Ok(NormalizedInput {
        name,
        projects: input
            .projects
            .into_iter()
            .map(|project| project.trim().to_string())
            .filter(|project| !project.is_empty())
            .collect(),
        prompt,
        schedule: input.schedule,
        cron_expression,
        agent: normalize_agent(input.agent, known_agents)?,
        model_provider: or_default(input.model_provider, default_model_provider),
        model: or_default(input.model, default_model),
        cwd_mode: input.cwd_mode.unwrap_or_default(),
    })
}

/// Trigger an automation task immediately, bypassing its cron schedule.
pub async fn run_automation_now(handle: &AutomationHandle, task_id: String) -> Result<(), String> {
    let (task, ctx) = {
        let guard = handle.lock().await;
        let task = guard
            .tasks
            .get(&task_id)
            .cloned()
            .ok_or_else(|| format!("automation '{}' not found", task_id))?;
        (task, guard.ctx.clone())
    };
    tokio::spawn(async move {
        execute_task(task, ctx).await;
    });
    Ok(())
}

pub async fn list_automation_runs(
    task_id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<AutomationRunRecord>, String> {
    automation_runs::list_runs(task_id.as_deref(), limit.unwrap_or(100) as usize)
}

pub async fn list_automations(handle: &AutomationHandle) -> Result<Vec<AutomationTask>, String> {
    let runtime = handle.lock().await;
    let mut tasks = runtime.tasks.values().cloned().collect::<Vec<AutomationTask>>();
    tasks.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(tasks)
}

pub async fn create_automation(
    handle: &AutomationHandle,
    input: AutomationInput,
) -> Result<AutomationTask, String> {
    let mut runtime = handle.lock().await;
    let known_agents = runtime.ctx.runners.keys().cloned().collect::<Vec<String>>();
    let input = normalize(input, &known_agents)?;

    let task = AutomationTask {
        id: format!("automation-{}", Uuid::new_v4()),
        name: input.name,
        projects: input.projects,
        prompt: input.prompt,
        agent: input.agent,
        model: input.model,
        model_provider: input.model_provider,
        schedule: input.schedule,
        cron_expression: input.cron_expression,
        created_at: Utc::now().to_rfc3339(),
        paused: false,
        cwd_mode: input.cwd_mode,
    };

    let job_id = schedule_task(&runtime.scheduler, runtime.ctx.clone(), &task).await?;
    runtime.job_ids.insert(task.id.clone(), job_id);
    runtime.tasks.insert(task.id.clone(), task.clone());

    save_store(&runtime.storage_path, runtime.tasks.values().cloned()).await?;
    Ok(task)
}

pub async fn update_automation(
    handle: &AutomationHandle,
    task_id: String,
    input: AutomationInput,
) -> Result<AutomationTask, String> {
    let mut runtime = handle.lock().await;
    let known_agents = runtime.ctx.runners.keys().cloned().collect::<Vec<String>>();
    let input = normalize(input, &known_agents)?;

    let existing = runtime
        .tasks
        .get(&task_id)
        .cloned()
        .ok_or_else(|| format!("automation '{}' not found", task_id))?;

    if let Some(job_id) = runtime.job_ids.remove(&task_id) {
        runtime
            .scheduler
            .remove(&job_id)
            .await
            .map_err(|err| err.to_string())?;
    }

    let updated = AutomationTask {
        id: existing.id,
        name: input.name,
        projects: input.projects,
        prompt: input.prompt,
        agent: input.agent,
        model: input.model,
        model_provider: input.model_provider,
        schedule: input.schedule,
        cron_expression: input.cron_expression,
        created_at: existing.created_at,
        paused: existing.paused,
        cwd_mode: input.cwd_mode,
    };

    if !updated.paused {
        let job_id = schedule_task(&runtime.scheduler, runtime.ctx.clone(), &updated).await?;
        runtime.job_ids.insert(task_id.clone(), job_id);
    }

    runtime.tasks.insert(task_id, updated.clone());
    save_store(&runtime.storage_path, runtime.tasks.values().cloned()).await?;
    Ok(updated)
}

pub async fn set_automation_paused(
    handle: &AutomationHandle,
    task_id: String,
    paused: bool,
) -> Result<AutomationTask, String> {
    let mut runtime = handle.lock().await;

    let task = runtime
        .tasks
        .get(&task_id)
        .cloned()
        .ok_or_else(|| format!("automation '{}' not found", task_id))?;

    if paused {
        if let Some(job_id) = runtime.job_ids.remove(&task_id) {
            runtime
                .scheduler
                .remove(&job_id)
                .await
                .map_err(|err| err.to_string())?;
        }
    } else if !runtime.job_ids.contains_key(&task_id) {
        let job_id = schedule_task(&runtime.scheduler, runtime.ctx.clone(), &task).await?;
        runtime.job_ids.insert(task_id.clone(), job_id);
    }

    let updated = AutomationTask { paused, ..task };
    runtime.tasks.insert(task_id, updated.clone());
    save_store(&runtime.storage_path, runtime.tasks.values().cloned()).await?;
    Ok(updated)
}

pub async fn delete_automation(handle: &AutomationHandle, task_id: String) -> Result<(), String> {
    let mut runtime = handle.lock().await;

    if !runtime.tasks.contains_key(&task_id) {
        return Err(format!("automation '{}' not found", task_id));
    }

    if let Some(job_id) = runtime.job_ids.remove(&task_id) {
        runtime
            .scheduler
            .remove(&job_id)
            .await
            .map_err(|err| err.to_string())?;
    }
    runtime.tasks.remove(&task_id);
    save_store(&runtime.storage_path, runtime.tasks.values().cloned()).await
}
