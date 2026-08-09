use std::sync::Arc;

use axum::{
    extract::FromRef,
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use serde_json::Value;
use tokio::sync::broadcast;

use codexia_acp::AcpState;
use codexia_cc::CCState;
use codexia_codex::AppState;
use codexia_shared::sleep::SleepState;
use crate::watcher::WebWatchState;
use crate::terminal::WebTerminalState;

#[derive(Clone)]
pub struct WebServerState {
    pub codex_state: Option<Arc<AppState>>,
    pub cc_state: Arc<CCState>,
    pub acp_state: Arc<AcpState>,
    pub(crate) sleep_state: Arc<SleepState>,
    pub(crate) terminal_state: Arc<WebTerminalState>,
    pub(crate) fs_watch_state: Arc<WebWatchState>,
    pub event_tx: broadcast::Sender<(String, Value)>,
}

impl WebServerState {
    pub fn new(
        codex_state: Option<Arc<AppState>>,
        cc_state: Arc<CCState>,
        acp_state: Arc<AcpState>,
        sleep_state: Arc<SleepState>,
        terminal_state: Arc<WebTerminalState>,
        fs_watch_state: Arc<WebWatchState>,
        event_tx: broadcast::Sender<(String, Value)>,
    ) -> Self {
        Self { codex_state, cc_state, acp_state, sleep_state, terminal_state, fs_watch_state, event_tx }
    }
}

impl FromRef<WebServerState> for broadcast::Sender<(String, Value)> {
    fn from_ref(state: &WebServerState) -> Self {
        state.event_tx.clone()
    }
}

#[derive(Serialize)]
pub(super) struct ErrorResponse {
    pub(super) error: String,
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(self)).into_response()
    }
}
