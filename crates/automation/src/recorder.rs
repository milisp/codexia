use codexia_db::automation_runs;

/// Persistence seam for run bookkeeping, so `execute_task` can be tested without a
/// database. Recording is best effort: a failure must never abort a task.
pub(super) trait RunRecorder: Send + Sync {
    fn started(
        &self,
        task_id: &str,
        task_name: &str,
        run_key: &str,
        cwd: Option<&str>,
        started_at: &str,
    );
    fn status(&self, task_id: &str, run_key: &str, status: &str);
}

fn log_db_error(task_id: &str, action: &str, result: Result<(), String>) {
    if let Err(err) = result {
        log::warn!("failed to {} for automation '{}': {}", action, task_id, err);
    }
}

pub(super) struct DbRunRecorder;

impl RunRecorder for DbRunRecorder {
    fn started(
        &self,
        task_id: &str,
        task_name: &str,
        run_key: &str,
        cwd: Option<&str>,
        started_at: &str,
    ) {
        log_db_error(
            task_id,
            "persist automation run started",
            automation_runs::insert_run_started(task_id, task_name, run_key, cwd, started_at),
        );
    }

    fn status(&self, task_id: &str, run_key: &str, status: &str) {
        log_db_error(
            task_id,
            "mark automation run status",
            automation_runs::mark_run_status_by_thread(run_key, status),
        );
    }
}
