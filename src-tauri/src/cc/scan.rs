use std::sync::Once;
use std::time::Instant;

use super::db::SessionCache;

static SESSION_SCANNER_START: Once = Once::new();

pub fn start_session_scanner() {
    SESSION_SCANNER_START.call_once(|| {
        std::thread::spawn(|| {
            sync_session_cache();
        });
    });
}

pub fn sync_project_session_cache(directory: &str, include_worktrees: bool) -> Result<(), String> {
    let started_at = Instant::now();
    let sessions = claude_agent_sdk_rs::sessions::list_sessions(Some(directory), None, 0, include_worktrees);
    SessionCache::new()?.replace_project_sessions(directory, &sessions, include_worktrees)?;
    log::info!(
        "[cc session scanner] synced {} project sessions for {} in {:?}",
        sessions.len(),
        directory,
        started_at.elapsed()
    );
    Ok(())
}

pub fn sync_session_cache() {
    let started_at = Instant::now();
    let sessions = claude_agent_sdk_rs::sessions::list_sessions(None, None, 0, true);

    match SessionCache::new().and_then(|mut cache| cache.replace_all(&sessions)) {
        Ok(()) => {
            log::info!(
                "[cc session scanner] synced {} sessions in {:?}",
                sessions.len(),
                started_at.elapsed()
            );
        }
        Err(err) => {
            log::error!("[cc session scanner] failed to sync session cache: {}", err);
        }
    }
}