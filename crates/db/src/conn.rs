use rusqlite::Connection;
use std::path::PathBuf;

/// Get the path to the SQLite database
fn get_db_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Could not get home directory")?;
    let codexia_dir = home_dir.join(".codexia");
    std::fs::create_dir_all(&codexia_dir)
        .map_err(|e| format!("Failed to create .codexia directory: {}", e))?;
    Ok(codexia_dir.join("cache.db"))
}

/// Get a database connection and ensure tables exist
pub(crate) fn get_connection() -> Result<Connection, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    init_tables(&conn)?;
    Ok(conn)
}

/// Initialize database tables
fn init_tables(conn: &Connection) -> Result<(), String> {
    init_notes_table(conn)?;
    init_automation_runs_tables(conn)?;
    init_acp_sessions_tables(conn)?;
    Ok(())
}

/// Create the ACP session list and its transcript table
fn init_acp_sessions_tables(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS acp_sessions (
            session_id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            agent_title TEXT,
            cwd TEXT NOT NULL,
            title TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create acp_sessions table: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS acp_session_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create acp_session_updates table: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_acp_sessions_cwd_updated
         ON acp_sessions(cwd, updated_at DESC)",
        [],
    )
    .map_err(|e| format!("Failed to create acp_sessions cwd index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_acp_session_updates_session
         ON acp_session_updates(session_id, id ASC)",
        [],
    )
    .map_err(|e| format!("Failed to create acp_session_updates index: {}", e))?;

    Ok(())
}

/// Create notes table and indexes
fn init_notes_table(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT,
            is_favorited BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            synced_at TEXT
        )",
        [],
    )
    .map_err(|e| format!("Failed to create notes table: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)",
        [],
    )
    .map_err(|e| format!("Failed to create notes user_id index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)",
        [],
    )
    .map_err(|e| format!("Failed to create notes updated_at index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_synced ON notes(synced_at)",
        [],
    )
    .map_err(|e| format!("Failed to create notes synced_at index: {}", e))?;

    Ok(())
}

fn init_automation_runs_tables(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS automation_runs (
            run_id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            task_name TEXT NOT NULL,
            thread_id TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create automation_runs table: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS automation_run_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            step_kind TEXT NOT NULL,
            turn_id TEXT,
            message TEXT,
            created_at TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create automation_run_steps table: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_automation_runs_task_started
         ON automation_runs(task_id, started_at DESC)",
        [],
    )
    .map_err(|e| format!("Failed to create automation_runs task index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_automation_runs_thread
         ON automation_runs(thread_id)",
        [],
    )
    .map_err(|e| format!("Failed to create automation_runs thread index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_automation_run_steps_run_created
         ON automation_run_steps(run_id, created_at ASC)",
        [],
    )
    .map_err(|e| format!("Failed to create automation_run_steps index: {}", e))?;

    Ok(())
}
