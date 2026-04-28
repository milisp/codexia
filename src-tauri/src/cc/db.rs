use claude_agent_sdk_rs::types::sessions::SdkSessionInfo;
use rusqlite::{Connection, Row, params};

fn parse_session_info_row(row: &Row<'_>) -> Result<SdkSessionInfo, rusqlite::Error> {
    Ok(SdkSessionInfo {
        session_id: row.get(0)?,
        summary: row.get(1)?,
        last_modified: row.get(2)?,
        file_size: row.get::<_, Option<i64>>(3)?.map(|size| size as u64),
        custom_title: row.get(4)?,
        first_prompt: row.get(5)?,
        git_branch: row.get(6)?,
        cwd: row.get(7)?,
        tag: row.get(8)?,
        created_at: row.get(9)?,
    })
}

pub struct SessionCache {
    conn: Connection,
}

impl SessionCache {
    pub fn new() -> Result<Self, String> {
        let home = dirs::home_dir().ok_or("Failed to get home directory")?;
        let db_dir = home.join(".codexia");
        std::fs::create_dir_all(&db_dir)
            .map_err(|e| format!("Failed to create .codexia directory: {}", e))?;

        let db_path = db_dir.join("cache.db");
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open session cache database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS cc_sessions (
                session_id TEXT PRIMARY KEY,
                summary TEXT NOT NULL,
                last_modified INTEGER NOT NULL,
                cwd TEXT,
                file_size INTEGER,
                custom_title TEXT,
                first_prompt TEXT,
                git_branch TEXT,
                tag TEXT,
                created_at INTEGER,
                synced_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_cc_sessions_cwd_last_modified
            ON cc_sessions(cwd, last_modified DESC);",
        )
        .map_err(|e| format!("Failed to initialize cc_sessions cache table: {}", e))?;

        Ok(Self { conn })
    }

    pub fn replace_all(&mut self, sessions: &[SdkSessionInfo]) -> Result<(), String> {
        let tx = self
            .conn
            .transaction()
            .map_err(|e| format!("Failed to start cc_sessions cache transaction: {}", e))?;

        tx.execute("DELETE FROM cc_sessions", [])
            .map_err(|e| format!("Failed to clear cc_sessions cache: {}", e))?;

        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO cc_sessions (
                        session_id,
                        summary,
                        last_modified,
                        cwd,
                        file_size,
                        custom_title,
                        first_prompt,
                        git_branch,
                        tag,
                        created_at,
                        synced_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, strftime('%s','now'))",
                )
                .map_err(|e| format!("Failed to prepare cc_sessions cache insert: {}", e))?;

            for session in sessions {
                stmt.execute(params![
                    session.session_id,
                    session.summary,
                    session.last_modified,
                    session.cwd,
                    session.file_size.map(|size| size as i64),
                    session.custom_title,
                    session.first_prompt,
                    session.git_branch,
                    session.tag,
                    session.created_at,
                ])
                .map_err(|e| format!("Failed to insert cc_sessions cache row: {}", e))?;
            }
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit cc_sessions cache transaction: {}", e))
    }

    pub fn replace_project_sessions(
        &mut self,
        directory: &str,
        sessions: &[SdkSessionInfo],
        include_worktrees: bool,
    ) -> Result<(), String> {
        let normalized_directory = directory.trim_end_matches('/');
        let worktree_prefix = format!("{}/.codexia/worktrees/%", normalized_directory);

        let tx = self
            .conn
            .transaction()
            .map_err(|e| format!("Failed to start cc_sessions project transaction: {}", e))?;

        if include_worktrees {
            tx.execute(
                "DELETE FROM cc_sessions WHERE cwd = ?1 OR cwd LIKE ?2",
                params![normalized_directory, worktree_prefix],
            )
            .map_err(|e| format!("Failed to clear project cc_sessions cache: {}", e))?;
        } else {
            tx.execute(
                "DELETE FROM cc_sessions WHERE cwd = ?1",
                params![normalized_directory],
            )
            .map_err(|e| format!("Failed to clear project cc_sessions cache: {}", e))?;
        }

        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO cc_sessions (
                        session_id,
                        summary,
                        last_modified,
                        cwd,
                        file_size,
                        custom_title,
                        first_prompt,
                        git_branch,
                        tag,
                        created_at,
                        synced_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, strftime('%s','now'))",
                )
                .map_err(|e| format!("Failed to prepare project cc_sessions insert: {}", e))?;

            for session in sessions {
                stmt.execute(params![
                    session.session_id,
                    session.summary,
                    session.last_modified,
                    session.cwd,
                    session.file_size.map(|size| size as i64),
                    session.custom_title,
                    session.first_prompt,
                    session.git_branch,
                    session.tag,
                    session.created_at,
                ])
                .map_err(|e| format!("Failed to insert project cc_sessions row: {}", e))?;
            }
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit project cc_sessions transaction: {}", e))
    }

    /// Returns `(sessions, total)` where `total` is the count of all matching rows
    /// (ignoring LIMIT/OFFSET), obtained via `COUNT(*) OVER()` in a single query.
    pub fn list_sessions(
        &self,
        directory: Option<&str>,
        limit: Option<usize>,
        offset: usize,
        include_worktrees: bool,
    ) -> Result<(Vec<SdkSessionInfo>, usize), String> {
        let mut query = String::from(
            "SELECT
                session_id,
                summary,
                last_modified,
                file_size,
                custom_title,
                first_prompt,
                git_branch,
                cwd,
                tag,
                created_at,
                COUNT(*) OVER() AS total
             FROM cc_sessions",
        );

        match directory {
            Some(_) => {
                query.push_str(" WHERE cwd = ?1");
                if include_worktrees {
                    query.push_str(" OR cwd LIKE ?2");
                }
            }
            None => {
                if !include_worktrees {
                    query.push_str(" WHERE cwd NOT LIKE ?1");
                }
            }
        }

        query.push_str(" ORDER BY last_modified DESC");

        if let Some(limit) = limit {
            query.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));
        } else if offset > 0 {
            query.push_str(&format!(" LIMIT -1 OFFSET {}", offset));
        }

        let mut stmt = self
            .conn
            .prepare(&query)
            .map_err(|e| format!("Failed to prepare cc_sessions cache query: {}", e))?;

        let parse_row_with_total = |row: &rusqlite::Row<'_>| -> rusqlite::Result<(SdkSessionInfo, usize)> {
            let session = parse_session_info_row(row)?;
            let total: i64 = row.get(10)?;
            Ok((session, total as usize))
        };

        let rows = match (directory, include_worktrees) {
            (Some(directory), true) => {
                let worktree_prefix = format!("{}/.codexia/worktrees/%", directory.trim_end_matches('/'));
                stmt.query_map(params![directory, worktree_prefix], parse_row_with_total)
            }
            (Some(directory), false) => stmt.query_map(params![directory], parse_row_with_total),
            (None, true) => stmt.query_map([], parse_row_with_total),
            (None, false) => stmt.query_map(params!["%/.codexia/worktrees/%"], parse_row_with_total),
        }
        .map_err(|e| format!("Failed to query cc_sessions cache: {}", e))?;

        let pairs: Vec<(SdkSessionInfo, usize)> = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read cc_sessions cache rows: {}", e))?;

        let total = pairs.first().map(|(_, t)| *t).unwrap_or(0);
        let sessions = pairs.into_iter().map(|(s, _)| s).collect();
        Ok((sessions, total))
    }

    pub fn delete_session(&self, session_id: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM cc_sessions WHERE session_id = ?1", [session_id])
            .map_err(|e| format!("Failed to delete cc_sessions cache row: {}", e))?;
        Ok(())
    }
}
