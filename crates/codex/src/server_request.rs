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
        // MCP servers (e.g. the bundled computer-use plugin) ask for per-action
        // approval through elicitation. Dropping it stalls the tool call until
        // the server times out, so it must reach the UI.
        "mcpServer/elicitation/request" => ("codex/elicitation-request", "mcpServerElicitation"),
        // Sandbox escalation (extra network or filesystem access) blocks the
        // turn the same way until the client answers.
        "item/permissions/requestApproval" => ("codex/permissions-request", "permissionsApproval"),
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
