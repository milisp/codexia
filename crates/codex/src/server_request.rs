use crate::protocol::RequestId;
use codexia_shared::event_sink::EventSink;
use serde_json::Value;
use std::sync::Arc;

// Handle server requests (approval requests)
pub async fn handle_server_request(
    event_sink: &Arc<dyn EventSink>,
    request_id: RequestId,
    method: &str,
    params: Value,
) {
    let (event, kind) = match method {
        "item/commandExecution/requestApproval" => ("codex/approval-request", "commandExecution"),
        "item/fileChange/requestApproval" => ("codex/approval-request", "fileChange"),
        "item/tool/requestUserInput" => ("codex/request-user-input", "requestUserInput"),
        // Ignore unsupported server requests
        _ => return,
    };

    let mut payload = params;
    let Value::Object(ref mut map) = payload else {
        return;
    };
    map.insert(
        "requestId".to_string(),
        serde_json::to_value(request_id).unwrap_or(Value::Null),
    );
    map.insert("type".to_string(), Value::String(kind.to_string()));

    event_sink.emit(event, payload);
}
