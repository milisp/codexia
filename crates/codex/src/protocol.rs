//! Minimal JSON-RPC envelope types for the codex app-server transport.
//!
//! The backend is a pass-through proxy: payloads travel as `serde_json::Value`
//! and the authoritative schema lives in the generated TS bindings under
//! `src/bindings` (`codex app-server generate-ts`). Only the envelope needs to
//! be understood in Rust.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JSON-RPC request id, either an integer or a string.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RequestId {
    Integer(i64),
    String(String),
}

impl RequestId {
    /// Pending requests are keyed by the integer id we generated.
    pub fn as_pending_key(&self) -> Option<u64> {
        match self {
            RequestId::Integer(i) => u64::try_from(*i).ok(),
            RequestId::String(s) => s.parse::<u64>().ok(),
        }
    }
}

/// A message received from the app-server.
pub enum ServerMessage {
    /// Successful response to a request we sent.
    Response { id: RequestId, result: Value },
    /// Error response to a request we sent.
    Error { id: RequestId, error: Value },
    /// Request initiated by the server (approvals, user input).
    Request {
        id: RequestId,
        method: String,
        params: Value,
    },
    /// Server notification. `raw` is the untouched `{method, params, ...}` envelope.
    Notification { method: String, raw: Value },
}

pub fn classify(value: &Value) -> Option<ServerMessage> {
    let obj = value.as_object()?;
    let id = obj.get("id").and_then(|v| serde_json::from_value(v.clone()).ok());

    match (obj.get("method"), id) {
        (Some(method), Some(id)) => Some(ServerMessage::Request {
            id,
            method: method.as_str()?.to_string(),
            params: obj.get("params").cloned().unwrap_or(Value::Null),
        }),
        (Some(method), None) => Some(ServerMessage::Notification {
            method: method.as_str()?.to_string(),
            raw: value.clone(),
        }),
        (None, Some(id)) => match obj.get("error") {
            Some(error) => Some(ServerMessage::Error {
                id,
                error: error.clone(),
            }),
            None => Some(ServerMessage::Response {
                id,
                result: obj.get("result").cloned().unwrap_or(Value::Null),
            }),
        },
        (None, None) => None,
    }
}
