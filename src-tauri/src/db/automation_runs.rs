use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::get_connection;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRunRecord {
    pub run_id: String,
    pub task_id: String,
    pub task_name: String,
    pub thread_id: String,
    pub status: String,
    pub started_at: String,
    pub updated_at: String,
}

pub fn insert_run_started(task_id: &str, task_name: &str, thread_id: &str, started_at: &str) -> Result<(), String> {
    let conn = get_connection()?;
    let now = Utc::now().to_rfc3339();
    let run_id = format!("run-{}", Uuid::new_v4());

    conn.execute(
        "INSERT INTO automation_runs (
            run_id, task_id, task_name, thread_id, status, started_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, 'running', ?5, ?6)
        ON CONFLICT(thread_id) DO UPDATE SET
            task_id = excluded.task_id,
            task_name = excluded.task_name,
            status = 'running',
            started_at = excluded.started_at,
            updated_at = excluded.updated_at",
        params![run_id, task_id, task_name, thread_id, started_at, now],
    )
    .map_err(|e| format!("Failed to insert automation run: {}", e))?;

    Ok(())
}

pub fn mark_run_status_by_thread(thread_id: &str, status: &str) -> Result<(), String> {
    let conn = get_connection()?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE automation_runs
         SET status = ?1, updated_at = ?2
         WHERE thread_id = ?3",
        params![status, now, thread_id],
    )
    .map_err(|e| format!("Failed to update automation run status: {}", e))?;
    Ok(())
}

pub fn mark_run_status_by_session(session_id: &str, status: &str) -> Result<(), String> {
    // For automation_runs, codex thread_id and cc session_id share the same storage column.
    mark_run_status_by_thread(session_id, status)
}

pub fn list_runs(task_id: Option<&str>, limit: usize) -> Result<Vec<AutomationRunRecord>, String> {
    let conn = get_connection()?;
    let limit = if limit == 0 { 100 } else { limit.min(500) };

    let mut rows: Vec<AutomationRunRecord> = Vec::new();
    if let Some(task_id) = task_id {
        let mut stmt = conn
            .prepare(
                "SELECT run_id, task_id, task_name, thread_id, status, started_at, updated_at
                 FROM automation_runs
                 WHERE task_id = ?1
                 ORDER BY started_at DESC
                 LIMIT ?2",
            )
            .map_err(|e| format!("Failed to prepare automation run list query: {}", e))?;
        let mapped = stmt
            .query_map(params![task_id, limit as i64], |row| {
                Ok(AutomationRunRecord {
                    run_id: row.get(0)?,
                    task_id: row.get(1)?,
                    task_name: row.get(2)?,
                    thread_id: row.get(3)?,
                    status: row.get(4)?,
                    started_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to query automation runs: {}", e))?;
        for item in mapped {
            rows.push(item.map_err(|e| format!("Failed to decode automation run row: {}", e))?);
        }
        return Ok(rows);
    }

    let mut stmt = conn
        .prepare(
            "SELECT run_id, task_id, task_name, thread_id, status, started_at, updated_at
             FROM automation_runs
             ORDER BY started_at DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare automation run list query: {}", e))?;
    let mapped = stmt
        .query_map(params![limit as i64], |row| {
            Ok(AutomationRunRecord {
                run_id: row.get(0)?,
                task_id: row.get(1)?,
                task_name: row.get(2)?,
                thread_id: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query automation runs: {}", e))?;
    for item in mapped {
        rows.push(item.map_err(|e| format!("Failed to decode automation run row: {}", e))?);
    }
    Ok(rows)
}
