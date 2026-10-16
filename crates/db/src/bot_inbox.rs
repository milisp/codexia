use chrono::Utc;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

use super::get_connection;

/// Something a bot left for its person: a draft to review before anything is
/// sent, or a step handed back because only a person can do it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotInboxItem {
    pub id: String,
    pub bot_id: String,
    /// The conversation it came from; Send and Done continue it.
    pub session_id: String,
    /// `draft` or `handback`.
    pub kind: String,
    pub title: String,
    /// The draft text, or the steps the person has to take.
    pub body: String,
    /// Draft: what the bot does with it on Send (empty: nothing to send, only
    /// copy). Hand-back: a link to where the step is done, if any.
    pub action: Option<String>,
    /// `open`, then `sent`, `discarded`, `done` or `dismissed`.
    pub status: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

pub(crate) fn init_table(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS bot_inbox (
            id TEXT PRIMARY KEY,
            bot_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            action TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            resolved_at TEXT
        )",
        [],
    )
    .map_err(|e| format!("Failed to create bot_inbox table: {e}"))?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_bot_inbox_status ON bot_inbox(status, created_at)",
        [],
    )
    .map_err(|e| format!("Failed to create bot_inbox index: {e}"))?;
    Ok(())
}

const COLUMNS: &str =
    "id, bot_id, session_id, kind, title, body, action, status, created_at, resolved_at";

fn row_to_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<BotInboxItem> {
    Ok(BotInboxItem {
        id: row.get(0)?,
        bot_id: row.get(1)?,
        session_id: row.get(2)?,
        kind: row.get(3)?,
        title: row.get(4)?,
        body: row.get(5)?,
        action: row.get(6)?,
        status: row.get(7)?,
        created_at: row.get(8)?,
        resolved_at: row.get(9)?,
    })
}

fn get_on(conn: &Connection, id: &str) -> Result<Option<BotInboxItem>, String> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM bot_inbox WHERE id = ?1"),
        params![id],
        row_to_item,
    )
    .optional()
    .map_err(|e| format!("Failed to read inbox item: {e}"))
}

#[allow(clippy::too_many_arguments)]
fn insert_on(
    conn: &Connection,
    id: &str,
    bot_id: &str,
    session_id: &str,
    kind: &str,
    title: &str,
    body: &str,
    action: Option<&str>,
) -> Result<BotInboxItem, String> {
    conn.execute(
        "INSERT INTO bot_inbox (id, bot_id, session_id, kind, title, body, action, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8)",
        params![id, bot_id, session_id, kind, title, body, action, Utc::now().to_rfc3339()],
    )
    .map_err(|e| format!("Failed to save inbox item: {e}"))?;
    get_on(conn, id)?.ok_or_else(|| "Failed to read back the inbox item".to_string())
}

fn list_open_on(conn: &Connection, bot_id: Option<&str>) -> Result<Vec<BotInboxItem>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM bot_inbox
             WHERE status = 'open' AND (?1 IS NULL OR bot_id = ?1)
             ORDER BY created_at ASC"
        ))
        .map_err(|e| format!("Failed to prepare inbox query: {e}"))?;
    let rows = stmt
        .query_map(params![bot_id], row_to_item)
        .map_err(|e| format!("Failed to query inbox: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read inbox: {e}"))
}

/// Close an open item. Returns `None` when it was already closed, so two
/// clients pressing Send at once cannot both send.
fn resolve_on(
    conn: &Connection,
    id: &str,
    status: &str,
    body: Option<&str>,
) -> Result<Option<BotInboxItem>, String> {
    let changed = conn
        .execute(
            "UPDATE bot_inbox SET status = ?2, body = COALESCE(?3, body), resolved_at = ?4
             WHERE id = ?1 AND status = 'open'",
            params![id, status, body, Utc::now().to_rfc3339()],
        )
        .map_err(|e| format!("Failed to update inbox item: {e}"))?;
    if changed == 0 {
        return Ok(None);
    }
    get_on(conn, id)
}

#[allow(clippy::too_many_arguments)]
pub fn insert(
    id: &str,
    bot_id: &str,
    session_id: &str,
    kind: &str,
    title: &str,
    body: &str,
    action: Option<&str>,
) -> Result<BotInboxItem, String> {
    insert_on(&get_connection()?, id, bot_id, session_id, kind, title, body, action)
}

pub fn get(id: &str) -> Result<Option<BotInboxItem>, String> {
    get_on(&get_connection()?, id)
}

/// Open items, oldest first, for one bot or all of them.
pub fn list_open(bot_id: Option<&str>) -> Result<Vec<BotInboxItem>, String> {
    list_open_on(&get_connection()?, bot_id)
}

pub fn resolve(id: &str, status: &str, body: Option<&str>) -> Result<Option<BotInboxItem>, String> {
    resolve_on(&get_connection()?, id, status, body)
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
    fn open_items_list_until_resolved_once() {
        let conn = conn();
        insert_on(&conn, "d1", "scout", "s1", "draft", "Reply to Ana", "Hi Ana", Some("send it"))
            .unwrap();
        insert_on(&conn, "h1", "shop", "s2", "handback", "Sign in", "Log in to the bank", None)
            .unwrap();
        assert_eq!(list_open_on(&conn, None).unwrap().len(), 2);
        assert_eq!(list_open_on(&conn, Some("scout")).unwrap()[0].id, "d1");

        let sent = resolve_on(&conn, "d1", "sent", Some("Hi Ana, edited")).unwrap().unwrap();
        assert_eq!((sent.status.as_str(), sent.body.as_str()), ("sent", "Hi Ana, edited"));
        assert!(sent.resolved_at.is_some());
        // A second Send finds nothing open.
        assert!(resolve_on(&conn, "d1", "sent", None).unwrap().is_none());

        let dismissed = resolve_on(&conn, "h1", "dismissed", None).unwrap().unwrap();
        assert_eq!(dismissed.body, "Log in to the bank");
        assert!(list_open_on(&conn, None).unwrap().is_empty());
    }
}
