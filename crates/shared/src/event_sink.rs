use serde_json::Value;

/// Abstract event sink. Implementations live in the consuming crates:
/// - `TauriEventSink` in `src-tauri` (emits via `tauri::AppHandle`)
/// - `WebSocketEventSink` in `web` (broadcasts to WebSocket clients)
pub trait EventSink: Send + Sync {
    fn emit(&self, event: &str, payload: Value);
}
