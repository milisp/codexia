use crate::state::{WatchState, WatcherKind};
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::{Config, EventKind, RecursiveMode};
use notify_debouncer_full::{new_debouncer_opt, DebouncedEvent, FileIdMap};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Serialize, Debug, Clone)]
pub struct FsChange {
    pub path: String,
    pub kind: String,
    pub is_dir: bool,
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

/// Build a Gitignore matcher rooted at `root`.
/// Falls back to an empty matcher if no .gitignore is found.
fn build_gitignore(root: &Path) -> Gitignore {
    let mut builder = GitignoreBuilder::new(root);
    let gitignore_path = root.join(".gitignore");
    if gitignore_path.exists() {
        let _ = builder.add(gitignore_path);
    }
    builder.build().unwrap_or(Gitignore::empty())
}

/// Returns true if the path should be ignored according to the gitignore rules.
fn is_ignored(gitignore: &Gitignore, path: &Path, is_dir: bool) -> bool {
    gitignore
        .matched_path_or_any_parents(path, is_dir)
        .is_ignore()
}

/// Start watching a path with debouncing (50ms default).
/// Uses gitignore to filter out ignored files.
pub async fn watch(
    state: &WatchState,
    path: String,
    emit: Arc<dyn Fn(FsChange) + Send + Sync>,
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

    // If already watching, increment ref count
    {
        let mut watchers = state.watchers.lock().await;
        if let Some((_existing, count)) = watchers.get_mut(&key) {
            *count += 1;
            return Ok(());
        }
    }

    let emit_for_cb = Arc::clone(&emit);
    // Build gitignore matcher rooted at the watched directory (or its parent for files).
    let gitignore_root = if abs.is_dir() {
        abs.clone()
    } else {
        abs.parent().unwrap_or(&abs).to_path_buf()
    };
    let gitignore = Arc::new(build_gitignore(&gitignore_root));

    let abs_clone = abs.clone();
    let is_dir = abs_clone.is_dir();

    // Use debouncer with 50ms delay and FileIdMap cache (explicit for cross-platform consistency)
    let mut debouncer = new_debouncer_opt(
        std::time::Duration::from_millis(50),
        None,
        move |events: Result<Vec<DebouncedEvent>, Vec<notify::Error>>| {
            if let Ok(events) = events {
                for event in events {
                    for p in event.event.paths.iter() {
                        let path_is_dir = p.is_dir();
                        if is_ignored(&gitignore, p, path_is_dir) {
                            continue;
                        }
                        let payload = FsChange {
                            path: p.to_string_lossy().to_string(),
                            kind: kind_to_string(&event.event.kind),
                            is_dir,
                        };
                        emit_for_cb(payload);
                    }
                }
            }
        },
        FileIdMap::new(),
        Config::default(),
    )
    .map_err(|e| format!("Failed to create debouncer: {}", e))?;

    // In notify-debouncer-full v0.6, debouncer implements Watcher directly
    debouncer
        .watch(&abs_clone, recursive_mode)
        .map_err(|e| format!("Failed to start watcher: {}", e))?;

    let mut watchers = state.watchers.lock().await;
    watchers.insert(key, (Mutex::new(WatcherKind::Debouncer(debouncer)), 1));
    Ok(())
}

/// Stop watching a path (decrements ref count, unwatches when count reaches 0)
pub async fn unwatch(state: &WatchState, path: String) -> Result<(), String> {
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
    if let Some((watcher_mutex, _)) = watchers.remove(&key) {
        let mut watcher_kind = watcher_mutex.lock().await;
        match &mut *watcher_kind {
            WatcherKind::Debouncer(debouncer) => {
                let _ = debouncer.unwatch(&abs);
            }
        }
    }
    Ok(())
}