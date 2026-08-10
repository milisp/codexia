use chrono::Local;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

use codexia_shared::agent_runner::AgentRunner;
use codexia_shared::event_sink::EventSink;

use super::execution::{ExecutionContext, execute_task};
use super::model::{AutomationStore, AutomationTask};
use super::recorder::DbRunRecorder;

pub(super) struct AutomationRuntime {
    pub(super) scheduler: JobScheduler,
    pub(super) storage_path: PathBuf,
    pub(super) tasks: HashMap<String, AutomationTask>,
    pub(super) job_ids: HashMap<String, Uuid>,
    pub(super) ctx: ExecutionContext,
}

/// Cheap-to-clone handle to the automation runtime. Hosts (`src-tauri`, `web`)
/// own one and pass it to the service functions.
#[derive(Clone)]
pub struct AutomationHandle(Arc<Mutex<AutomationRuntime>>);

impl AutomationHandle {
    /// Starts the scheduler and schedules every stored task that is not paused.
    pub async fn start(
        runners: Vec<Arc<dyn AgentRunner>>,
        event_sink: Arc<dyn EventSink>,
    ) -> Result<Self, String> {
        let ctx = ExecutionContext {
            runners: Arc::new(
                runners
                    .into_iter()
                    .map(|runner| (runner.agent().to_string(), runner))
                    .collect(),
            ),
            event_sink,
            recorder: Arc::new(DbRunRecorder),
        };

        let mut runtime = AutomationRuntime {
            scheduler: JobScheduler::new().await.map_err(|err| err.to_string())?,
            storage_path: resolve_storage_path()?,
            tasks: HashMap::new(),
            job_ids: HashMap::new(),
            ctx,
        };
        runtime.scheduler.start().await.map_err(|err| err.to_string())?;

        let store = load_store(&runtime.storage_path).await?;
        for task in store.tasks {
            if !task.paused {
                match schedule_task(&runtime.scheduler, runtime.ctx.clone(), &task).await
                {
                    Ok(job_id) => {
                        runtime.job_ids.insert(task.id.clone(), job_id);
                    }
                    Err(err) => {
                        log::warn!("failed to schedule automation '{}': {}", task.id, err);
                    }
                }
            }
            runtime.tasks.insert(task.id.clone(), task);
        }

        Ok(Self(Arc::new(Mutex::new(runtime))))
    }

    pub(super) async fn lock(&self) -> tokio::sync::MutexGuard<'_, AutomationRuntime> {
        self.0.lock().await
    }
}

pub(super) fn resolve_storage_path() -> Result<PathBuf, String> {
    let mut base = dirs::home_dir().ok_or_else(|| "failed to resolve home directory".to_string())?;
    base.push(".codexia");
    std::fs::create_dir_all(&base).map_err(|err| err.to_string())?;
    Ok(base.join("automations.json"))
}

pub(super) async fn load_store(path: &Path) -> Result<AutomationStore, String> {
    if !path.exists() {
        return Ok(AutomationStore::default());
    }
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|err| err.to_string())?;
    serde_json::from_str::<AutomationStore>(&content).map_err(|err| err.to_string())
}

pub(super) async fn save_store(
    path: &Path,
    tasks: impl Iterator<Item = AutomationTask>,
) -> Result<(), String> {
    let mut store = AutomationStore {
        tasks: tasks.collect(),
    };
    // Tasks come from a HashMap; sort so the file stays stable across writes.
    store.tasks.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    let content = serde_json::to_string_pretty(&store).map_err(|err| err.to_string())?;

    // Write to a sibling temp file and rename, so a crash cannot truncate the store.
    let temp_path = path.with_extension("json.tmp");
    tokio::fs::write(&temp_path, content)
        .await
        .map_err(|err| err.to_string())?;
    tokio::fs::rename(&temp_path, path)
        .await
        .map_err(|err| err.to_string())
}

pub(super) async fn schedule_task(
    scheduler: &JobScheduler,
    ctx: ExecutionContext,
    task: &AutomationTask,
) -> Result<Uuid, String> {
    let task_for_run = task.clone();
    let job = Job::new_async_tz(task.cron_expression.as_str(), Local, move |_job_id, _scheduler| {
        let ctx = ctx.clone();
        let task = task_for_run.clone();
        Box::pin(async move {
            execute_task(task, ctx).await;
        })
    })
    .map_err(|err| err.to_string())?;

    let job_id = job.guid();
    scheduler.add(job).await.map_err(|err| err.to_string())?;
    Ok(job_id)
}
