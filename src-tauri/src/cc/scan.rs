use std::path::Path;
use std::sync::Once;
use std::time::{Duration, Instant};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use super::db::SessionCache;

static SESSION_SCANNER_START: Once = Once::new();

pub fn start_session_scanner() {
    SESSION_SCANNER_START.call_once(|| {
        std::thread::spawn(|| {
            let home = match dirs::home_dir() {
                Some(path) => path,
                None => return,
            };
            let projects_root = home.join(".claude").join("projects");
            if !projects_root.exists() {
                return;
            }

            let (tx, rx) = std::sync::mpsc::channel();
            let mut watcher: RecommendedWatcher = match notify::recommended_watcher(tx) {
                Ok(watcher) => watcher,
                Err(err) => {
                    log::error!("cc session scanner: watcher init failed: {}", err);
                    return;
                }
            };

            if let Err(err) = watcher.watch(&projects_root, RecursiveMode::Recursive) {
                log::error!("cc session scanner: watch failed: {}", err);
                return;
            }

            let mut last_scan = Instant::now() - Duration::from_secs(60);
            let mut pending_rescan = false;

            loop {
                match rx.recv_timeout(Duration::from_millis(200)) {
                    Ok(Ok(event)) => {
                        if !should_rescan_for_event(&event) {
                            continue;
                        }

                        if last_scan.elapsed() < Duration::from_millis(500) {
                            pending_rescan = true;
                        } else {
                            last_scan = Instant::now();
                            sync_session_cache();
                            pending_rescan = false;
                        }
                    }
                    Ok(Err(err)) => {
                        log::error!("cc session scanner: watch event error: {}", err);
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                }

                if pending_rescan && last_scan.elapsed() >= Duration::from_millis(500) {
                    last_scan = Instant::now();
                    sync_session_cache();
                    pending_rescan = false;
                }
            }
        });
    });
}

fn should_rescan_for_event(event: &Event) -> bool {
    if matches!(event.kind, EventKind::Access(_)) {
        return false;
    }

    let is_relevant_kind = matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_)
    );
    if !is_relevant_kind {
        return false;
    }

    event.paths.iter().any(|path| is_session_jsonl(path))
}

fn is_session_jsonl(path: &Path) -> bool {
    if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
        return false;
    }

    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or("");
    !file_name.starts_with("agent-")
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