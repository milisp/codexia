use std::sync::{Arc, Mutex};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use tokio::sync::{broadcast, oneshot};

use codexia_cc::CCState;
use codexia_codex::AppState;
use codexia_web::tailscale::{self, TailscaleInfo};

const REMOTE_PORT: u16 = 7420;

/// Holds the running remote server, if any.
///
/// The desktop app owns the codex and cc sessions; the remote server borrows
/// that same state so a phone drives the very session the user has open rather
/// than a second, parallel one.
pub struct RemoteState {
    inner: Mutex<Option<Running>>,
    /// Events are fanned out here for the whole lifetime of the app, so the
    /// server can be started later without swapping the app's event sink.
    pub event_tx: broadcast::Sender<(String, Value)>,
}

struct Running {
    shutdown: oneshot::Sender<()>,
    info: RemoteStatus,
}

#[derive(Clone, Debug, Serialize)]
pub struct RemoteStatus {
    pub running: bool,
    pub port: u16,
    pub host: Option<String>,
    pub tailscale: Option<TailscaleInfo>,
    pub token: Option<String>,
}

impl RemoteState {
    pub fn new(event_tx: broadcast::Sender<(String, Value)>) -> Self {
        Self { inner: Mutex::new(None), event_tx }
    }
}

fn settings_path() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|home| home.join(".codexia").join("settings.json"))
}

/// Whether the user left remote access switched on.
///
/// Kept in the same `settings.json` the frontend uses, under its own top-level
/// key, so the desktop comes back up serving the phone without the user having
/// to walk to the machine and flip the switch after every restart.
pub fn remote_enabled() -> bool {
    let Some(path) = settings_path() else { return false };
    let Ok(raw) = std::fs::read_to_string(&path) else { return false };
    serde_json::from_str::<Value>(&raw)
        .ok()
        .and_then(|v| v.get("remote")?.get("enabled")?.as_bool())
        .unwrap_or(false)
}

/// Records the toggle, leaving every other key in the file untouched.
fn set_remote_enabled(enabled: bool) {
    let Some(path) = settings_path() else { return };

    let mut settings = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .filter(|value| value.is_object())
        .unwrap_or_else(|| serde_json::json!({}));

    settings["remote"] = serde_json::json!({ "enabled": enabled });

    if let Some(parent) = path.parent() {
        if let Err(err) = std::fs::create_dir_all(parent) {
            log::warn!("[remote] could not create {}: {err}", parent.display());
            return;
        }
    }
    match serde_json::to_string_pretty(&settings) {
        Ok(contents) => {
            if let Err(err) = std::fs::write(&path, contents) {
                log::warn!("[remote] could not write {}: {err}", path.display());
            }
        }
        Err(err) => log::warn!("[remote] could not serialize settings: {err}"),
    }
}

fn stopped_status() -> RemoteStatus {
    RemoteStatus {
        running: false,
        port: REMOTE_PORT,
        host: None,
        tailscale: tailscale::detect(),
        token: None,
    }
}

#[tauri::command]
pub async fn remote_status(remote: State<'_, RemoteState>) -> Result<RemoteStatus, String> {
    let running = remote.inner.lock().map_err(|_| "remote state poisoned")?;
    Ok(match running.as_ref() {
        Some(active) => active.info.clone(),
        None => stopped_status(),
    })
}

#[tauri::command]
pub async fn remote_start(
    app: AppHandle,
    remote: State<'_, RemoteState>,
    cc_state: State<'_, CCState>,
) -> Result<RemoteStatus, String> {
    let status = start_server(&app, &remote, &cc_state)?;
    set_remote_enabled(true);
    Ok(status)
}

/// Brings the server up against the app's live state.
///
/// Shared by the command and by startup, which reuses it to restore the switch
/// the user last left on.
pub fn start_server(
    app: &AppHandle,
    remote: &RemoteState,
    cc_state: &CCState,
) -> Result<RemoteStatus, String> {
    {
        let running = remote.inner.lock().map_err(|_| "remote state poisoned")?;
        if let Some(active) = running.as_ref() {
            return Ok(active.info.clone());
        }
    }

    // Bind to the tailnet address specifically rather than 0.0.0.0: the server
    // exposes shell and filesystem access, so it should be reachable from the
    // user's own devices and nothing else on the local network.
    let info = tailscale::detect().ok_or_else(|| {
        log::warn!("[remote] tailscale::detect() found no usable node; not starting");
        "Tailscale is not running. Install it, sign in, and try again.".to_string()
    })?;

    log::info!(
        "[remote] starting: dns_name={} ipv4={} port={REMOTE_PORT}",
        info.dns_name,
        info.ipv4
    );

    let token = codexia_web::auth::DeviceToken::load_or_create()?;
    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    // codex is absent when its app-server failed to start; the remote server
    // still serves cc and the session list, matching desktop behaviour.
    let codex = app
        .try_state::<AppState>()
        .map(|s| Arc::new(AppState { codex: s.codex.clone() }));
    let cc = Arc::new(cc_state.clone());
    // Share the desktop's ACP state so remote clients see the same sessions.
    let acp = app
        .try_state::<codexia_acp::AcpState>()
        .map(|s| Arc::new(s.inner().clone()))
        .ok_or_else(|| "ACP state is not initialized".to_string())?;
    // Reuse the desktop's scheduler rather than starting a second one.
    let automation = app
        .try_state::<codexia_automation::AutomationHandle>()
        .map(|s| s.inner().clone());
    let event_tx = remote.event_tx.clone();
    let host = info.ipv4.clone();

    let serve_host = host.clone();
    tauri::async_runtime::spawn(async move {
        let result = codexia_web::serve_api(
            codex,
            automation,
            cc,
            acp,
            event_tx,
            &serve_host,
            REMOTE_PORT,
            async {
                let _ = shutdown_rx.await;
            },
        )
        .await;

        if let Err(err) = result {
            log::error!("[remote] {err}");
        }
    });

    let status = RemoteStatus {
        running: true,
        port: REMOTE_PORT,
        host: Some(host),
        tailscale: Some(info),
        token: Some(token.value().to_string()),
    };

    let mut running = remote.inner.lock().map_err(|_| "remote state poisoned")?;
    *running = Some(Running { shutdown: shutdown_tx, info: status.clone() });
    Ok(status)
}

/// Issues a new device token, invalidating every existing pairing.
///
/// The running router captured the old token when it started, so the server is
/// bounced here — otherwise the revoked token would keep working until the next
/// app restart.
#[tauri::command]
pub async fn remote_rotate_token(
    app: AppHandle,
    remote: State<'_, RemoteState>,
    cc_state: State<'_, CCState>,
) -> Result<RemoteStatus, String> {
    let was_running = {
        let mut running = remote.inner.lock().map_err(|_| "remote state poisoned")?;
        match running.take() {
            Some(active) => {
                let _ = active.shutdown.send(());
                true
            }
            None => false,
        }
    };

    codexia_web::auth::DeviceToken::rotate()?;
    log::info!("[remote] device token rotated; paired devices must pair again");

    if was_running {
        start_server(&app, &remote, &cc_state)
    } else {
        Ok(stopped_status())
    }
}

#[tauri::command]
pub async fn remote_stop(remote: State<'_, RemoteState>) -> Result<RemoteStatus, String> {
    let mut running = remote.inner.lock().map_err(|_| "remote state poisoned")?;
    if let Some(active) = running.take() {
        // The receiver going away also ends the server, so ignoring a send
        // failure here is correct rather than merely tolerable.
        let _ = active.shutdown.send(());
    }
    drop(running);
    set_remote_enabled(false);
    Ok(stopped_status())
}
