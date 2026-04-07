use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Instant;

use serde_json::Value;
use tokio::sync::broadcast;

use super::{router::create_router, types::WebServerState};
use crate::cc::CCState;
use crate::codex::scan::start_history_scanner;
use crate::codex::{AppState, CodexInitializationState, connect_codex, initialize_codex};
use crate::features::event_sink::{EventSink, WebSocketEventSink};
use crate::features::sleep::SleepState;
use crate::web_server::filesystem_watch::WebWatchState;

pub async fn start_web_server_with_events(
    codex_state: Option<Arc<AppState>>,
    cc_state: Arc<CCState>,
    event_tx: broadcast::Sender<(String, Value)>,
    host: &str,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Ok(cwd) = std::env::current_dir() {
        log::info!("[web] startup cwd: {}", cwd.display());
    } else {
        log::info!("[web] startup cwd: <unavailable>");
    }
    log::info!("[web] requested port: {}", port);

    let automation_sink: Arc<dyn EventSink> = Arc::new(WebSocketEventSink::new(event_tx.clone()));
    crate::features::automation::initialize_automation_runtime(
        codex_state.as_ref().map(|s| s.codex.clone()),
        cc_state.as_ref().clone(),
        automation_sink,
    )
    .await
    .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;

    let history_sink: Arc<dyn EventSink> = Arc::new(WebSocketEventSink::new(event_tx.clone()));
    start_history_scanner(history_sink);
    crate::cc::scan::start_session_scanner();

    let state = WebServerState {
        codex_state,
        cc_state,
        sleep_state: Arc::new(SleepState::default()),
        terminal_state: Arc::new(super::terminal::WebTerminalState::default()),
        fs_watch_state: Arc::new(WebWatchState::default()),
        event_tx,
    };

    let app = create_router(state);
    let listener = tokio::net::TcpListener::bind(format!("{}:{}", host, port)).await?;

    log::info!("Web server listening on http://{}:{}", host, port);

    axum::serve(listener, app).await?;

    Ok(())
}

pub async fn start_web_server(host: &str, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let boot_started_at = Instant::now();
    let (event_tx, _) = broadcast::channel(100);
    let event_sink: Arc<dyn EventSink> = Arc::new(WebSocketEventSink::new(event_tx.clone()));
    let init_state = CodexInitializationState::new(Arc::clone(&event_sink));

    let connect_started_at = Instant::now();
    let codex_state = match connect_codex(Arc::clone(&event_sink)).await {
        Ok(codex) => {
            log::info!(
                "[web] startup timing: connect_codex finished in {:?}",
                connect_started_at.elapsed()
            );

            if !init_state.initialized.load(Ordering::SeqCst) {
                let _guard = init_state.init_lock.lock().await;
                if !init_state.initialized.load(Ordering::SeqCst) {
                    let initialize_started_at = Instant::now();
                    if let Err(e) =
                        initialize_codex(&codex, Arc::clone(&init_state.event_sink)).await
                    {
                        log::warn!("[web] codex initialize failed, continuing without codex: {e}");
                    } else {
                        log::info!(
                            "[web] startup timing: initialize_codex finished in {:?}",
                            initialize_started_at.elapsed()
                        );
                        init_state.initialized.store(true, Ordering::SeqCst);
                    }
                }
            }

            Some(Arc::new(AppState { codex }))
        }
        Err(e) => {
            log::warn!(
                "[web] codex binary not found or failed to start ({}), continuing without codex backend",
                e
            );
            None
        }
    };

    let cc_state = Arc::new(CCState::new(Arc::new(WebSocketEventSink::new(event_tx.clone()))));
    log::info!("[web] boot completed in {:?}", boot_started_at.elapsed());
    start_web_server_with_events(codex_state, cc_state, event_tx, host, port).await
}
