use crate::codex_client::CodexClient;
use notify::RecommendedWatcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use crate::codex::CodexAppServerClient;

pub struct AppState {
    pub clients: Arc<Mutex<HashMap<String, CodexAppServerClient>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub async fn get_client(
    state: &tauri::State<'_, AppState>,
    session_id: &str,
) -> Result<CodexAppServerClient, String> {
    let clients_guard = state.clients.lock().await;
    clients_guard
        .get(session_id)
        .cloned()
        .ok_or_else(|| format!("Client for session_id '{}' not found.", session_id))
}

pub struct CodexState {
    pub sessions: Arc<Mutex<HashMap<String, CodexClient>>>,
    // Active filesystem watchers keyed by absolute folder path with ref-count
    pub watchers: Arc<Mutex<HashMap<String, (RecommendedWatcher, usize)>>>,
}

impl CodexState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteUiStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub bind_address: Option<String>,
    pub public_url: Option<String>,
    pub info_url: Option<String>,
    pub bundle_path: Option<String>,
    pub minimize_app: bool,
    pub application_ui: bool,
}

impl Default for RemoteUiStatus {
    fn default() -> Self {
        Self {
            running: false,
            port: None,
            bind_address: None,
            public_url: None,
            info_url: None,
            bundle_path: None,
            minimize_app: false,
            application_ui: false,
        }
    }
}

pub struct RemoteAccessState {
    pub status: Arc<RwLock<RemoteUiStatus>>,
}

impl Default for RemoteAccessState {
    fn default() -> Self {
        Self {
            status: Arc::new(RwLock::new(RemoteUiStatus::default())),
        }
    }
}
