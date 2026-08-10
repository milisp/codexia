use chrono::Utc;
use dashmap::DashSet;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

use codexia_shared::agent_runner::{AgentRunOutcome, AgentRunSpec, AgentRunner};
use codexia_shared::event_sink::EventSink;

use super::model::{AutomationTask, CwdMode, default_model, default_model_provider};
use super::recorder::RunRecorder;
use super::worktree::prepare_worktree;

/// Upper bound for a single agent run, so a stalled agent cannot block a task forever.
const RUN_TIMEOUT: Duration = Duration::from_secs(60 * 60);

/// Task ids with a run in flight, so a cron tick cannot stack on top of a slow run.
static RUNNING_TASKS: LazyLock<DashSet<String>> = LazyLock::new(DashSet::new);

/// Everything a scheduled job needs to execute a task.
#[derive(Clone)]
pub(super) struct ExecutionContext {
    pub(super) runners: Arc<HashMap<String, Arc<dyn AgentRunner>>>,
    pub(super) event_sink: Arc<dyn EventSink>,
    pub(super) recorder: Arc<dyn RunRecorder>,
}

/// Marks a task as running for as long as it is alive.
struct RunGuard(String);

impl RunGuard {
    fn acquire(task_id: &str) -> Option<Self> {
        if RUNNING_TASKS.insert(task_id.to_string()) {
            Some(Self(task_id.to_string()))
        } else {
            None
        }
    }
}

impl Drop for RunGuard {
    fn drop(&mut self) {
        RUNNING_TASKS.remove(&self.0);
    }
}

fn target_cwds(task: &AutomationTask) -> Vec<Option<String>> {
    if task.projects.is_empty() {
        vec![None]
    } else {
        task.projects
            .iter()
            .map(|project| Some(project.clone()))
            .collect()
    }
}

/// A skip is neither success nor failure: no session was started, so there is no run
/// to record and nothing failed.
fn emit_skipped(ctx: &ExecutionContext, task_id: &str, reason: &str) {
    log::warn!("automation '{}' skipped: {}", task_id, reason);
    ctx.event_sink.emit(
        "automation:run/skipped",
        json!({ "taskId": task_id, "reason": reason }),
    );
}

pub(super) async fn execute_task(task: AutomationTask, ctx: ExecutionContext) {
    let Some(_guard) = RunGuard::acquire(&task.id) else {
        emit_skipped(&ctx, &task.id, "a previous run is still in flight");
        return;
    };

    let Some(runner) = ctx.runners.get(&task.agent) else {
        emit_skipped(
            &ctx,
            &task.id,
            &format!("no runner registered for agent '{}'", task.agent),
        );
        return;
    };

    let model = if task.model.trim().is_empty() {
        default_model()
    } else {
        task.model.clone()
    };
    let model_provider = if task.model_provider.trim().is_empty() {
        default_model_provider()
    } else {
        task.model_provider.clone()
    };

    let mut failures: Vec<String> = Vec::new();
    for target_cwd in target_cwds(&task) {
        let result = match resolve_run_cwd(&task, target_cwd.as_deref()).await {
            Ok(run_cwd) => {
                run_one_target(
                    runner.as_ref(),
                    &ctx,
                    &task,
                    model.as_str(),
                    model_provider.as_str(),
                    run_cwd.as_deref(),
                )
                .await
            }
            Err(err) => Err(err),
        };
        if let Err(err) = result {
            log::error!(
                "automation '{}' failed for target {:?}: {}",
                task.id,
                target_cwd,
                err
            );
            failures.push(match target_cwd {
                Some(cwd) => format!("{cwd}: {err}"),
                None => err,
            });
        }
    }

    if failures.is_empty() {
        log::info!("automation '{}' executed", task.id);
    } else {
        let error = failures.join("; ");
        log::error!("automation '{}' execution failed: {}", task.id, error);
        ctx.event_sink.emit(
            "automation:run/failed",
            json!({ "taskId": task.id, "error": error }),
        );
    }
}

/// Resolves the directory the agent will run in, creating the task's worktree when
/// the task asks for one.
///
/// A worktree failure fails the target rather than falling back to the project
/// directory: the task explicitly asked not to touch the checkout, and an
/// unattended run has nobody to notice a silent downgrade.
async fn resolve_run_cwd(
    task: &AutomationTask,
    target_cwd: Option<&str>,
) -> Result<Option<String>, String> {
    if task.cwd_mode != CwdMode::Worktree {
        return Ok(target_cwd.map(str::to_string));
    }
    let Some(project) = target_cwd else {
        // Without a project there is no repository to branch a worktree from.
        log::warn!(
            "automation '{}' asks for a worktree but has no project; running in the default directory",
            task.id
        );
        return Ok(None);
    };
    prepare_worktree(&task.id, project)
        .await
        .map(Some)
        .map_err(|err| format!("failed to prepare worktree: {err}"))
}

async fn run_one_target(
    runner: &dyn AgentRunner,
    ctx: &ExecutionContext,
    task: &AutomationTask,
    model: &str,
    model_provider: &str,
    target_cwd: Option<&str>,
) -> Result<(), String> {
    // The runner reports its run key (codex thread id / cc session id) as soon as it
    // exists, which is well before a synchronous run finishes.
    let run_key: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let on_started = {
        let run_key = Arc::clone(&run_key);
        let task_id = task.id.clone();
        let task_name = task.name.clone();
        let cwd = target_cwd.map(str::to_string);
        let event_sink = Arc::clone(&ctx.event_sink);
        let recorder = Arc::clone(&ctx.recorder);
        Arc::new(move |key: &str| {
            if let Ok(mut slot) = run_key.lock() {
                *slot = Some(key.to_string());
            }
            let started_at = Utc::now().to_rfc3339();
            event_sink.emit(
                "automation:run/started",
                json!({
                    "taskId": task_id,
                    "taskName": task_name,
                    "threadId": key,
                    "cwd": cwd,
                    "startedAt": started_at,
                }),
            );
            recorder.started(
                task_id.as_str(),
                task_name.as_str(),
                key,
                cwd.as_deref(),
                started_at.as_str(),
            );
        })
    };

    let spec = AgentRunSpec {
        task_id: task.id.clone(),
        task_name: task.name.clone(),
        prompt: task.prompt.clone(),
        model: model.to_string(),
        model_provider: model_provider.to_string(),
        cwd: target_cwd.map(str::to_string),
        on_started,
    };

    let outcome = tokio::time::timeout(RUN_TIMEOUT, runner.start_run(spec))
        .await
        .unwrap_or_else(|_| Err(format!("timed out after {} seconds", RUN_TIMEOUT.as_secs())));

    let key = run_key.lock().ok().and_then(|slot| slot.clone());
    match (&outcome, key) {
        // A detached run reports its own final status out of band.
        (Ok(AgentRunOutcome::Detached), _) => {}
        (Ok(AgentRunOutcome::Finished), Some(key)) => {
            ctx.recorder.status(&task.id, key.as_str(), "completed")
        }
        (Err(_), Some(key)) => ctx.recorder.status(&task.id, key.as_str(), "failed"),
        // Failed before the agent produced a run key, so there is no row to update.
        (_, None) => {}
    }

    outcome.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AutomationSchedule, AutomationScheduleMode};
    use async_trait::async_trait;
    use serde_json::Value;
    use tokio::sync::{Notify, mpsc};

    /// Runner that records the cwd of every call and fails for configured cwds.
    struct FakeRunner {
        outcome: fn() -> AgentRunOutcome,
        fail_for: Vec<String>,
        calls: Arc<Mutex<Vec<Option<String>>>>,
        /// Set to block inside `start_run` until released.
        gate: Option<(mpsc::UnboundedSender<()>, Arc<Notify>)>,
    }

    impl FakeRunner {
        fn new() -> Self {
            Self {
                outcome: || AgentRunOutcome::Finished,
                fail_for: Vec::new(),
                calls: Arc::new(Mutex::new(Vec::new())),
                gate: None,
            }
        }
    }

    #[async_trait]
    impl AgentRunner for FakeRunner {
        fn agent(&self) -> &'static str {
            "fake"
        }

        async fn start_run(&self, spec: AgentRunSpec) -> Result<AgentRunOutcome, String> {
            self.calls.lock().unwrap().push(spec.cwd.clone());
            let key = format!("run-key-{}", spec.cwd.clone().unwrap_or_default());
            (spec.on_started)(key.as_str());

            if let Some((entered_tx, release)) = self.gate.as_ref() {
                let _ = entered_tx.send(());
                release.notified().await;
            }

            if let Some(cwd) = spec.cwd.as_ref() {
                if self.fail_for.contains(cwd) {
                    return Err("boom".to_string());
                }
            }
            Ok((self.outcome)())
        }
    }

    #[derive(Default)]
    struct RecordingSink {
        events: Mutex<Vec<(String, Value)>>,
    }

    impl EventSink for RecordingSink {
        fn emit(&self, event: &str, payload: Value) {
            self.events
                .lock()
                .unwrap()
                .push((event.to_string(), payload));
        }
    }

    impl RecordingSink {
        fn names(&self) -> Vec<String> {
            self.events
                .lock()
                .unwrap()
                .iter()
                .map(|(event, _)| event.clone())
                .collect()
        }

        fn payload_of(&self, event: &str) -> Option<Value> {
            self.events
                .lock()
                .unwrap()
                .iter()
                .find(|(name, _)| name == event)
                .map(|(_, payload)| payload.clone())
        }
    }

    #[derive(Default)]
    struct RecordingRecorder {
        started: Mutex<Vec<(String, Option<String>)>>,
        statuses: Mutex<Vec<(String, String)>>,
    }

    impl RunRecorder for RecordingRecorder {
        fn started(
            &self,
            _task_id: &str,
            _task_name: &str,
            run_key: &str,
            cwd: Option<&str>,
            _started_at: &str,
        ) {
            self.started
                .lock()
                .unwrap()
                .push((run_key.to_string(), cwd.map(str::to_string)));
        }

        fn status(&self, _task_id: &str, run_key: &str, status: &str) {
            self.statuses
                .lock()
                .unwrap()
                .push((run_key.to_string(), status.to_string()));
        }
    }

    fn task(id: &str, agent: &str, projects: &[&str]) -> AutomationTask {
        AutomationTask {
            id: id.to_string(),
            name: format!("task {id}"),
            projects: projects.iter().map(|p| (*p).to_string()).collect(),
            prompt: "do the thing".to_string(),
            agent: agent.to_string(),
            model: "test-model".to_string(),
            model_provider: "test-provider".to_string(),
            schedule: AutomationSchedule {
                mode: AutomationScheduleMode::Daily,
                hour: Some(9),
                minute: Some(0),
                interval_hours: None,
                weekdays: vec![],
            },
            cron_expression: "0 0 9 * * *".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            paused: false,
            cwd_mode: CwdMode::Cwd,
        }
    }

    fn context(
        runner: Arc<dyn AgentRunner>,
        sink: Arc<RecordingSink>,
        recorder: Arc<RecordingRecorder>,
    ) -> ExecutionContext {
        let mut runners: HashMap<String, Arc<dyn AgentRunner>> = HashMap::new();
        runners.insert(runner.agent().to_string(), runner);
        ExecutionContext {
            runners: Arc::new(runners),
            event_sink: sink,
            recorder,
        }
    }

    #[tokio::test]
    async fn runs_every_project_even_when_one_fails() {
        let runner = Arc::new(FakeRunner {
            fail_for: vec!["/b".to_string()],
            ..FakeRunner::new()
        });
        let calls = Arc::clone(&runner.calls);
        let sink = Arc::new(RecordingSink::default());
        let recorder = Arc::new(RecordingRecorder::default());
        let ctx = context(runner, Arc::clone(&sink), Arc::clone(&recorder));

        execute_task(task("t1", "fake", &["/a", "/b", "/c"]), ctx).await;

        // The failing middle project must not stop the ones after it.
        assert_eq!(
            *calls.lock().unwrap(),
            vec![
                Some("/a".to_string()),
                Some("/b".to_string()),
                Some("/c".to_string())
            ]
        );
        assert_eq!(
            *recorder.statuses.lock().unwrap(),
            vec![
                ("run-key-/a".to_string(), "completed".to_string()),
                ("run-key-/b".to_string(), "failed".to_string()),
                ("run-key-/c".to_string(), "completed".to_string()),
            ]
        );
        let failed = sink
            .payload_of("automation:run/failed")
            .expect("a failed event");
        assert_eq!(failed["error"], json!("/b: boom"));
    }

    #[tokio::test]
    async fn emits_skipped_when_no_runner_is_registered() {
        let sink = Arc::new(RecordingSink::default());
        let recorder = Arc::new(RecordingRecorder::default());
        let ctx = context(
            Arc::new(FakeRunner::new()),
            Arc::clone(&sink),
            Arc::clone(&recorder),
        );

        execute_task(task("t2", "codex", &[]), ctx).await;

        let skipped = sink
            .payload_of("automation:run/skipped")
            .expect("a skipped event");
        assert_eq!(
            skipped["reason"],
            json!("no runner registered for agent 'codex'")
        );
        assert!(sink.payload_of("automation:run/failed").is_none());
        assert!(recorder.started.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn emits_skipped_when_a_run_is_already_in_flight() {
        let (entered_tx, mut entered_rx) = mpsc::unbounded_channel();
        let release = Arc::new(Notify::new());
        let runner = Arc::new(FakeRunner {
            gate: Some((entered_tx, Arc::clone(&release))),
            ..FakeRunner::new()
        });
        let calls = Arc::clone(&runner.calls);
        let sink = Arc::new(RecordingSink::default());
        let recorder = Arc::new(RecordingRecorder::default());
        let ctx = context(runner, Arc::clone(&sink), Arc::clone(&recorder));

        let first = tokio::spawn({
            let ctx = ctx.clone();
            async move { execute_task(task("t3", "fake", &["/a"]), ctx).await }
        });

        // Wait until the first run is actually inside the runner.
        entered_rx.recv().await.expect("first run to start");

        execute_task(task("t3", "fake", &["/a"]), ctx).await;
        assert_eq!(
            sink.payload_of("automation:run/skipped").expect("skipped")["reason"],
            json!("a previous run is still in flight")
        );

        release.notify_waiters();
        first.await.expect("first run to finish");

        // The overlapping tick must not have reached the agent.
        assert_eq!(calls.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn releases_the_guard_after_a_run_finishes() {
        let runner = Arc::new(FakeRunner::new());
        let calls = Arc::clone(&runner.calls);
        let sink = Arc::new(RecordingSink::default());
        let ctx = context(
            runner,
            Arc::clone(&sink),
            Arc::new(RecordingRecorder::default()),
        );

        execute_task(task("t4", "fake", &["/a"]), ctx.clone()).await;
        execute_task(task("t4", "fake", &["/a"]), ctx).await;

        assert_eq!(calls.lock().unwrap().len(), 2);
        assert!(sink.payload_of("automation:run/skipped").is_none());
    }

    #[tokio::test]
    async fn worktree_mode_without_a_project_runs_in_the_default_directory() {
        let runner = Arc::new(FakeRunner::new());
        let calls = Arc::clone(&runner.calls);
        let sink = Arc::new(RecordingSink::default());
        let ctx = context(
            runner,
            Arc::clone(&sink),
            Arc::new(RecordingRecorder::default()),
        );

        let mut worktree_task = task("t6", "fake", &[]);
        worktree_task.cwd_mode = CwdMode::Worktree;
        execute_task(worktree_task, ctx).await;

        // No project means no repository to branch from, so no git work is attempted.
        assert_eq!(*calls.lock().unwrap(), vec![None]);
        assert!(sink.payload_of("automation:run/failed").is_none());
    }

    #[tokio::test]
    async fn cwd_mode_defaults_to_the_project_directory() {
        let runner = Arc::new(FakeRunner::new());
        let calls = Arc::clone(&runner.calls);
        let recorder = Arc::new(RecordingRecorder::default());
        let ctx = context(
            runner,
            Arc::new(RecordingSink::default()),
            Arc::clone(&recorder),
        );

        execute_task(task("t7", "fake", &["/a"]), ctx).await;

        assert_eq!(*calls.lock().unwrap(), vec![Some("/a".to_string())]);
        // The recorded run points at the directory the agent actually used.
        assert_eq!(
            *recorder.started.lock().unwrap(),
            vec![("run-key-/a".to_string(), Some("/a".to_string()))]
        );
    }

    #[tokio::test]
    async fn detached_runs_keep_their_status_open() {
        let runner = Arc::new(FakeRunner {
            outcome: || AgentRunOutcome::Detached,
            ..FakeRunner::new()
        });
        let sink = Arc::new(RecordingSink::default());
        let recorder = Arc::new(RecordingRecorder::default());
        let ctx = context(runner, Arc::clone(&sink), Arc::clone(&recorder));

        execute_task(task("t5", "fake", &[]), ctx).await;

        // Codex reports completion from its event stream, so nothing is written here.
        assert_eq!(
            *recorder.started.lock().unwrap(),
            vec![("run-key-".to_string(), None)]
        );
        assert!(recorder.statuses.lock().unwrap().is_empty());
        assert_eq!(sink.names(), vec!["automation:run/started".to_string()]);
    }
}
