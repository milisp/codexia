use serde_json::Value;
use tauri::Emitter;

pub use codexia_shared::event_sink::EventSink;

pub struct TauriEventSink {
    app_handle: tauri::AppHandle,
}

impl TauriEventSink {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { app_handle }
    }
}

impl EventSink for TauriEventSink {
    fn emit(&self, event: &str, payload: Value) {
        let _ = self.app_handle.emit(event, payload);
    }
}

/// Emits every event into a broadcast channel, which the remote server's
/// WebSocket/SSE endpoints consume.
pub struct BroadcastEventSink {
    tx: tokio::sync::broadcast::Sender<(String, Value)>,
}

impl BroadcastEventSink {
    pub fn new(tx: tokio::sync::broadcast::Sender<(String, Value)>) -> Self {
        Self { tx }
    }
}

impl EventSink for BroadcastEventSink {
    fn emit(&self, event: &str, payload: Value) {
        // Err just means no remote client is connected; the event still reached
        // the webview through the other sink.
        let _ = self.tx.send((event.to_string(), payload));
    }
}

/// Delivers each event to several sinks.
///
/// The desktop always fans out to both the webview and the remote broadcast
/// channel. Wiring this at startup — rather than swapping the sink when remote
/// access is toggled — means the codex client and CCState keep the sink they
/// were constructed with, so toggling cannot leave live sessions emitting into
/// a stale destination.
pub struct FanOutEventSink {
    sinks: Vec<std::sync::Arc<dyn EventSink>>,
}

impl FanOutEventSink {
    pub fn new(sinks: Vec<std::sync::Arc<dyn EventSink>>) -> Self {
        Self { sinks }
    }
}

impl EventSink for FanOutEventSink {
    fn emit(&self, event: &str, payload: Value) {
        for sink in &self.sinks {
            sink.emit(event, payload.clone());
        }
    }
}
