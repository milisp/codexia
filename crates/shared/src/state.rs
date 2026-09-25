use notify_debouncer_full::{Debouncer, FileIdMap};
use notify::RecommendedWatcher;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub enum WatcherKind {
    Debouncer(Debouncer<RecommendedWatcher, FileIdMap>),
}

/// A watcher plus the number of subscribers sharing it.
type WatcherEntry = (Mutex<WatcherKind>, usize);

pub struct WatchState {
    pub watchers: Arc<Mutex<HashMap<String, WatcherEntry>>>,
}

impl WatchState {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Default for WatchState {
    fn default() -> Self {
        Self::new()
    }
}