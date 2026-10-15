use chrono::Utc;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use super::get_connection;

/// One unattended bot run: a routine, another bot asking, or a resumed
/// conversation. Kept so the Today view can say what finished while nobody
/// was watching, without reading every transcript.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotRunRecord {
    pub run_id: String,
    pub bot_id: String,
    pub session_id: Option<String>,
    /// `routine`, `bot`, ... — the `codexia.dev/trigger` kind of the turn.
    pub trigger_kind: String,
    /// The routine's name, or the asking bot's.
    pub trigger_name: Option<String>,
    /// `working`, `waiting`, `done`, `blocked` or `failed`.
    pub status: String,
    /// The start of the bot's reply, once the run has finished.
    pub summary: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
}

pub(crate) fn init_table(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS bot_runs (
            run_id TEXT PRIMARY KEY,
            bot_id TEXT NOT NULL,
            session_id TEXT,
            trigger_kind TEXT NOT NULL,
            trigger_name TEXT,
            status TEXT NOT NULL,
            summary TEXT,
            started_at TEXT NOT NULL,
            finished_at TEXT
        )",
        [],
    )
    .map_err(|e| format!("Failed to create bot_runs table: {e}"))?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_bot_runs_started ON bot_runs(started_at DESC)",
        [],
    )
    .map_err(|e| format!("Failed to create bot_runs index: {e}"))?;
    Ok(())
}

const COLUMNS: &str = "run_id, bot_id, session_id, trigger_kind, trigger_name, status, \
     summary, started_at, finished_at";

fn row_to_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<BotRunRecord> {
    Ok(BotRunRecord {
        run_id: row.get(0)?,
        bot_id: row.get(1)?,
        session_id: row.get(2)?,
        trigger_kind: row.get(3)?,
        trigger_name: row.get(4)?,
        status: row.get(5)?,
        summary: row.get(6)?,
        started_at: row.get(7)?,
        finished_at: row.get(8)?,
    })
}

fn insert_on(
    conn: &Connection,
    run_id: &str,
    bot_id: &str,
    trigger_kind: &str,
    trigger_name: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO bot_runs (run_id, bot_id, trigger_kind, trigger_name, status, started_at)
         VALUES (?1, ?2, ?3, ?4, 'working', ?5)",
        params![run_id, bot_id, trigger_kind, trigger_name, Utc::now().to_rfc3339()],
    )
    .map_err(|e| format!("Failed to record bot run: {e}"))?;
    Ok(())
}

fn update_on(
    conn: &Connection,
    run_id: &str,
    session_id: Option<&str>,
    status: &str,
    summary: Option<&str>,
) -> Result<(), String> {
    let finished = matches!(status, "done" | "blocked" | "failed").then(|| Utc::now().to_rfc3339());
    conn.execute(
        "UPDATE bot_runs SET
            session_id = COALESCE(?2, session_id),
            status = ?3,
            summary = COALESCE(?4, summary),
            finished_at = COALESCE(?5, finished_at)
         WHERE run_id = ?1",
        params![run_id, session_id, status, summary, finished],
    )
    .map_err(|e| format!("Failed to update bot run: {e}"))?;
    Ok(())
}

fn list_on(conn: &Connection, limit: usize) -> Result<Vec<BotRunRecord>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM bot_runs ORDER BY started_at DESC LIMIT ?1"
        ))
        .map_err(|e| format!("Failed to prepare bot run query: {e}"))?;
    let rows = stmt
        .query_map(params![limit.clamp(1, 500) as i64], row_to_run)
        .map_err(|e| format!("Failed to query bot runs: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read bot runs: {e}"))
}

fn fail_orphaned_on(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "UPDATE bot_runs SET status = 'failed', finished_at = ?1
         WHERE status IN ('working', 'waiting')",
        params![Utc::now().to_rfc3339()],
    )
    .map_err(|e| format!("Failed to fail orphaned bot runs: {e}"))?;
    Ok(())
}

/// Record a run as it starts.
pub fn insert_started(
    run_id: &str,
    bot_id: &str,
    trigger_kind: &str,
    trigger_name: Option<&str>,
) -> Result<(), String> {
    insert_on(&get_connection()?, run_id, bot_id, trigger_kind, trigger_name)
}

/// Move a run to `status`. A finishing status also stamps `finished_at`;
/// `None` fields keep their stored value.
pub fn update(
    run_id: &str,
    session_id: Option<&str>,
    status: &str,
    summary: Option<&str>,
) -> Result<(), String> {
    update_on(&get_connection()?, run_id, session_id, status, summary)
}

/// The most recent runs of every bot, newest first.
pub fn list_recent(limit: usize) -> Result<Vec<BotRunRecord>, String> {
    list_on(&get_connection()?, limit)
}

/// Runs still open from a previous process: their agent died with it.
pub fn fail_orphaned() -> Result<(), String> {
    fail_orphaned_on(&get_connection()?)
}

/// The start of a reply, short enough for a one-line summary: its first
/// paragraph, cut at a character boundary.
pub fn summarize(reply: &str) -> Option<String> {
    const MAX: usize = 280;
    let paragraph = reply.trim().split("\n\n").next()?.trim();
    if paragraph.is_empty() {
        return None;
    }
    if paragraph.chars().count() <= MAX {
        return Some(paragraph.to_string());
    }
    let cut: String = paragraph.chars().take(MAX).collect();
    Some(format!("{}…", cut.trim_end()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_table(&conn).unwrap();
        conn
    }

    #[test]
    fn a_run_moves_from_working_to_finished() {
        let conn = conn();
        insert_on(&conn, "r1", "bot", "routine", Some("Daily brief")).unwrap();
        update_on(&conn, "r1", Some("s1"), "waiting", None).unwrap();
        let run = &list_on(&conn, 10).unwrap()[0];
        assert_eq!((run.status.as_str(), run.session_id.as_deref()), ("waiting", Some("s1")));
        assert!(run.finished_at.is_none());

        update_on(&conn, "r1", None, "done", Some("All good")).unwrap();
        let run = &list_on(&conn, 10).unwrap()[0];
        assert_eq!(run.status, "done");
        assert_eq!(run.session_id.as_deref(), Some("s1"));
        assert_eq!(run.summary.as_deref(), Some("All good"));
        assert_eq!(run.trigger_name.as_deref(), Some("Daily brief"));
        assert!(run.finished_at.is_some());
    }

    #[test]
    fn orphaned_runs_fail_and_finished_ones_stay() {
        let conn = conn();
        insert_on(&conn, "open", "bot", "routine", None).unwrap();
        insert_on(&conn, "closed", "bot", "bot", Some("Scout")).unwrap();
        update_on(&conn, "closed", None, "done", None).unwrap();
        fail_orphaned_on(&conn).unwrap();
        let runs = list_on(&conn, 10).unwrap();
        let status = |id: &str| runs.iter().find(|r| r.run_id == id).unwrap().status.clone();
        assert_eq!(status("open"), "failed");
        assert_eq!(status("closed"), "done");
    }

    #[test]
    fn summaries_keep_the_first_paragraph() {
        assert_eq!(summarize("  \n "), None);
        assert_eq!(summarize("Done.\n\nDetails").as_deref(), Some("Done."));
        let long = "é".repeat(400);
        let summary = summarize(&long).unwrap();
        assert_eq!(summary.chars().count(), 281);
        assert!(summary.ends_with('…'));
    }
}
