//! Anonymous, opt-in usage counters.
//!
//! One consent and one once-per-day dedupe per machine, kept in
//! `~/.codexia/telemetry.json` and shared by every client (desktop, browser,
//! phone). Only an event name, the app version, the OS and the CPU architecture
//! are ever sent, to the endpoint compiled in via `CODEXIA_TELEMETRY_URL`.
//! Nothing is sent, and no prompt is shown, until the user has at least one bot.
//! See docs/PRIVACY.md.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

/// Compile-time endpoint. Unset or empty disables telemetry entirely.
const ENDPOINT: Option<&str> = option_env!("CODEXIA_TELEMETRY_URL");

/// This crate uses the workspace version, which is the app version
/// (package.json and tauri.conf.json follow it).
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

const SEND_TIMEOUT: Duration = Duration::from_secs(10);

/// Serializes read-modify-write cycles on the state file.
static STATE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Consent {
    #[default]
    Unset,
    Granted,
    Denied,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Event {
    AppActive,
    BotCreated,
    BotRoutineCreated,
    BotRunDone,
    BotRunBlocked,
    BotRunFailed,
    BotAsk,
}

impl Event {
    pub fn name(self) -> &'static str {
        match self {
            Event::AppActive => "app_active",
            Event::BotCreated => "bot_created",
            Event::BotRoutineCreated => "bot_routine_created",
            Event::BotRunDone => "bot_run_done",
            Event::BotRunBlocked => "bot_run_blocked",
            Event::BotRunFailed => "bot_run_failed",
            Event::BotAsk => "bot_ask",
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct State {
    consent: Consent,
    /// Event name to the UTC day (`YYYY-MM-DD`) it was last sent.
    sent: HashMap<String, String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct Status {
    /// An endpoint is built in and `DO_NOT_TRACK` is not set.
    pub available: bool,
    pub consent: Consent,
    /// The user has at least one non-archived bot.
    pub eligible: bool,
}

fn state_path() -> Option<PathBuf> {
    Some(dirs::home_dir()?.join(".codexia").join("telemetry.json"))
}

fn load_state() -> State {
    state_path()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_state(state: &State) -> Result<(), String> {
    let path = state_path().ok_or("Failed to get home directory")?;
    let dir = path.parent().ok_or("Invalid telemetry path")?;
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create .codexia directory: {e}"))?;
    let content = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize telemetry state: {e}"))?;
    // Atomic replace: write a sibling temp file, then rename over the target.
    let tmp = dir.join(format!("telemetry.json.{}.tmp", std::process::id()));
    fs::write(&tmp, content).map_err(|e| format!("Failed to write telemetry state: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Failed to save telemetry state: {e}")
    })
}

fn endpoint() -> Option<&'static str> {
    ENDPOINT.map(str::trim).filter(|u| !u.is_empty())
}

fn do_not_track() -> bool {
    std::env::var("DO_NOT_TRACK").is_ok_and(|v| v.trim() == "1")
}

fn available() -> bool {
    endpoint().is_some() && !do_not_track()
}

fn has_bots() -> bool {
    codexia_db::bots::list_bots(false).is_ok_and(|bots| !bots.is_empty())
}

pub fn status() -> Status {
    let available = available();
    Status {
        available,
        consent: load_state().consent,
        // Skip the database when there is nothing to prompt for.
        eligible: available && has_bots(),
    }
}

pub fn set_consent(consent: Consent) -> Result<(), String> {
    let _guard = STATE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut state = load_state();
    state.consent = consent;
    save_state(&state)
}

/// Pure gating decision: should `event` be sent given the current facts?
fn should_send(
    available: bool,
    consent: Consent,
    eligible: bool,
    sent: &HashMap<String, String>,
    event: Event,
    today: &str,
) -> bool {
    available
        && consent == Consent::Granted
        && eligible
        && sent.get(event.name()).map(String::as_str) != Some(today)
}

fn platform() -> &'static str {
    match std::env::consts::OS {
        "macos" => "macos",
        "windows" => "windows",
        _ => "linux",
    }
}

fn arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        _ => "unknown",
    }
}

fn payload(event: Event) -> serde_json::Value {
    serde_json::json!({
        "events": [{
            "name": event.name(),
            "version": APP_VERSION,
            "platform": platform(),
            "arch": arch(),
        }]
    })
}

/// Record one event, at most once per event name per UTC day per machine.
///
/// No-op unless an endpoint is built in, `DO_NOT_TRACK` is unset, the user
/// granted consent and has at least one bot. Fire-and-forget: the request is
/// spawned on the current tokio runtime, and skipped when there is none.
pub fn track(event: Event) {
    if !available() {
        return;
    }
    let Some(url) = endpoint() else { return };
    let Ok(runtime) = tokio::runtime::Handle::try_current() else {
        return;
    };

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    {
        let _guard = STATE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let mut state = load_state();
        // Cheap checks first; the bot lookup only runs when everything else passes.
        if !should_send(true, state.consent, true, &state.sent, event, &today) || !has_bots() {
            return;
        }
        state.sent.insert(event.name().to_string(), today);
        if let Err(e) = save_state(&state) {
            log::debug!("telemetry: could not save state: {e}");
            return;
        }
    }

    let body = payload(event);
    runtime.spawn(async move {
        let client = match reqwest::Client::builder().timeout(SEND_TIMEOUT).build() {
            Ok(client) => client,
            Err(_) => return,
        };
        let _ = client.post(url).json(&body).send().await;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sent(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn sends_when_everything_allows_it() {
        assert!(should_send(true, Consent::Granted, true, &sent(&[]), Event::BotAsk, "2026-01-02"));
    }

    #[test]
    fn dedupes_per_event_per_day() {
        let map = sent(&[("bot_ask", "2026-01-02")]);
        assert!(!should_send(true, Consent::Granted, true, &map, Event::BotAsk, "2026-01-02"));
        assert!(should_send(true, Consent::Granted, true, &map, Event::BotAsk, "2026-01-03"));
        assert!(should_send(true, Consent::Granted, true, &map, Event::BotCreated, "2026-01-02"));
    }

    #[test]
    fn gating_blocks_sending() {
        let none = sent(&[]);
        let day = "2026-01-02";
        assert!(!should_send(false, Consent::Granted, true, &none, Event::AppActive, day));
        assert!(!should_send(true, Consent::Unset, true, &none, Event::AppActive, day));
        assert!(!should_send(true, Consent::Denied, true, &none, Event::AppActive, day));
        assert!(!should_send(true, Consent::Granted, false, &none, Event::AppActive, day));
    }

    #[test]
    fn events_serialize_as_snake_case() {
        let json = serde_json::to_string(&Event::BotRoutineCreated).unwrap();
        assert_eq!(json, "\"bot_routine_created\"");
        assert_eq!(Event::BotRoutineCreated.name(), "bot_routine_created");
    }

    #[test]
    fn corrupt_state_falls_back_to_defaults() {
        let state: State = serde_json::from_str("{\"consent\": 7}").unwrap_or_default();
        assert_eq!(state.consent, Consent::Unset);
        assert!(state.sent.is_empty());
    }

    #[test]
    fn payload_has_only_the_allowed_fields() {
        let body = payload(Event::AppActive);
        let event = &body["events"][0];
        let mut keys: Vec<_> = event.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        assert_eq!(keys, ["arch", "name", "platform", "version"]);
    }
}
