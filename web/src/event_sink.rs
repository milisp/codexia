use codexia_shared::event_sink::EventSink;
use serde_json::Value;
use tokio::sync::broadcast;

/// Standalone web server sink: pushes events into a broadcast channel
/// consumed by the WebSocket router.
pub struct WebSocketEventSink {
    tx: broadcast::Sender<(String, Value)>,
}

impl WebSocketEventSink {
    pub fn new(tx: broadcast::Sender<(String, Value)>) -> Self {
        Self { tx }
    }
}

impl EventSink for WebSocketEventSink {
    fn emit(&self, event: &str, payload: Value) {
        let _ = self.tx.send((event.to_string(), payload));
    }
}
