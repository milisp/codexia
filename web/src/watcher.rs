use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher, recommended_watcher};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::{Mutex, broadcast};

#[derive(Default)]
pub struct WebWatchState {
    pub(crate) watchers: Arc<Mutex<HashMap<String, (RecommendedWatcher, usize)>>>,
}

fn expand_path(input: &str) -> Result<PathBuf, String> {
    if let Some(rest) = input.strip_prefix("~/") {
        let home = dirs::home_dir().ok_or_else(|| "Cannot find home directory".to_string())?;
        Ok(home.join(rest))
    } else {
        Ok(Path::new(input).to_path_buf())
    }
}

fn kind_to_string(kind: &EventKind) -> String {
    use notify::event::*;
    match kind {
        EventKind::Create(CreateKind::Any) => "create".into(),
        EventKind::Create(_) => "create".into(),
        EventKind::Modify(ModifyKind::Any) => "modify".into(),
        EventKind::Modify(_) => "modify".into(),
        EventKind::Remove(RemoveKind::Any) => "remove".into(),
        EventKind::Remove(_) => "remove".into(),
        EventKind::Access(_) => "access".into(),
        EventKind::Other => "other".into(),
        EventKind::Any => "any".into(),
    }
}

pub(crate) async fn start_watch_path(
    state: &WebWatchState,
    event_tx: broadcast::Sender<(String, Value)>,
    path: String,
) -> Result<(), String> {
    let abs = expand_path(&path)?;
    if !abs.exists() {
        return Err("Path does not exist".to_string());
    }

    let recursive_mode = if abs.is_dir() {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    let key = match std::fs::canonicalize(&abs) {
        Ok(p) => p.to_string_lossy().to_string(),
        Err(_) => abs.to_string_lossy().to_string(),
    };

    {
        let mut watchers = state.watchers.lock().await;
        if let Some((_existing, count)) = watchers.get_mut(&key) {
            *count += 1;
            return Ok(());
        }
    }

    let event_tx_for_cb = event_tx.clone();
    let mut watcher: RecommendedWatcher =
        recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                for p in event.paths.iter() {
                    let payload = json!({
                        "path": p.to_string_lossy().to_string(),
                        "kind": kind_to_string(&event.kind),
                    });
                    let _ = event_tx_for_cb.send(("fs_change".to_string(), payload));
                }
            }
        })
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(&abs, recursive_mode)
        .map_err(|e| format!("Failed to start watcher: {}", e))?;

    let mut watchers = state.watchers.lock().await;
    watchers.insert(key, (watcher, 1));
    Ok(())
}

pub(crate) async fn unwatch_path(state: &WebWatchState, path: String) -> Result<(), String> {
    let abs = expand_path(&path)?;
    let key = match std::fs::canonicalize(&abs) {
        Ok(p) => p.to_string_lossy().to_string(),
        Err(_) => abs.to_string_lossy().to_string(),
    };

    let mut watchers = state.watchers.lock().await;
    if let Some((_, count)) = watchers.get_mut(&key)
        && *count > 1
    {
        *count -= 1;
        return Ok(());
    }
    if let Some((mut watcher, _)) = watchers.remove(&key) {
        let _ = watcher.unwatch(&abs);
    }
    Ok(())
}