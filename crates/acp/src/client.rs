use std::process::Stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};

use codexia_shared::event_sink::EventSink;
use dashmap::DashMap;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{Mutex, oneshot};

use crate::agents::AcpAgentDef;

/// Single event channel for everything an ACP connection produces.
/// Payloads always carry `connectionId` plus a `kind` discriminator.
pub const ACP_EVENT: &str = "acp-message";

/// The ACP protocol version we speak.
const PROTOCOL_VERSION: i64 = 1;

type Pending = Arc<DashMap<i64, oneshot::Sender<Result<Value, String>>>>;

pub struct AcpClient {
    pub connection_id: String,
    pub agent_id: String,
    /// Set after `session/new` succeeds.
    pub session_id: Mutex<Option<String>>,
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    next_id: AtomicI64,
    pending: Pending,
    /// JSON-RPC id of an in-flight `session/request_permission`, keyed by the
    /// request id we hand to the frontend.
    pending_permissions: Arc<DashMap<String, oneshot::Sender<Value>>>,
    sink: Arc<dyn EventSink>,
}

impl AcpClient {
    /// Spawn the agent process and run the ACP handshake (`initialize`).
    /// Does not create a session yet — see [`AcpClient::new_session`].
    pub async fn spawn(
        connection_id: String,
        agent: &AcpAgentDef,
        cwd: Option<&str>,
        sink: Arc<dyn EventSink>,
    ) -> Result<(Arc<Self>, Value), String> {
        let mut cmd = Command::new(&agent.command);
        cmd.args(&agent.args)
            .envs(&agent.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("failed to spawn `{}`: {e}", agent.command))?;
        let stdin = child.stdin.take().ok_or("failed to open agent stdin")?;
        let stdout = child.stdout.take().ok_or("failed to open agent stdout")?;
        let stderr = child.stderr.take().ok_or("failed to open agent stderr")?;

        let client = Arc::new(Self {
            connection_id: connection_id.clone(),
            agent_id: agent.id.clone(),
            session_id: Mutex::new(None),
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            next_id: AtomicI64::new(1),
            pending: Arc::new(DashMap::new()),
            pending_permissions: Arc::new(DashMap::new()),
            sink,
        });

        // stdout: JSON-RPC frames, one per line.
        {
            let client = client.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if line.trim().is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<Value>(&line) {
                        Ok(msg) => client.handle_incoming(msg).await,
                        Err(e) => log::warn!("acp: bad frame from agent: {e}: {line}"),
                    }
                }
                client.emit(json!({ "kind": "exited" }));
                // Fail every request still waiting on a reply.
                let ids: Vec<i64> = client.pending.iter().map(|e| *e.key()).collect();
                for id in ids {
                    if let Some((_, tx)) = client.pending.remove(&id) {
                        let _ = tx.send(Err("agent exited".to_string()));
                    }
                }
            });
        }

        // stderr: surfaced to the UI as log lines.
        {
            let client = client.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    log::debug!("acp stderr: {line}");
                    client.emit(json!({ "kind": "stderr", "line": line }));
                }
            });
        }

        let init = client
            .request(
                "initialize",
                json!({
                    "protocolVersion": PROTOCOL_VERSION,
                    "clientCapabilities": {
                        "fs": { "readTextFile": true, "writeTextFile": true },
                        "terminal": false
                    },
                    "clientInfo": { "name": "codexia", "version": env!("CARGO_PKG_VERSION") }
                }),
            )
            .await?;

        Ok((client, init))
    }

    /// Returns the full `session/new` result: besides `sessionId` it carries
    /// `modes`, `models` and `configOptions`, which drive the session controls.
    pub async fn new_session(&self, cwd: &str) -> Result<Value, String> {
        let res = self
            .request(
                "session/new",
                json!({ "cwd": cwd, "mcpServers": [] }),
            )
            .await?;
        let session_id = res
            .get("sessionId")
            .and_then(Value::as_str)
            .ok_or("session/new returned no sessionId")?
            .to_string();
        *self.session_id.lock().await = Some(session_id);
        Ok(res)
    }

    pub async fn set_mode(&self, mode_id: &str) -> Result<Value, String> {
        self.session_request("session/set_mode", json!({ "modeId": mode_id }))
            .await
    }

    /// `reasoning_effort` rides along in `_meta`: agents that advertise
    /// per-model efforts (Grok) read it there, others ignore it.
    pub async fn set_model(
        &self,
        model_id: &str,
        reasoning_effort: Option<&str>,
    ) -> Result<Value, String> {
        let mut params = json!({ "modelId": model_id });
        if let Some(effort) = reasoning_effort {
            params["_meta"] = json!({ "reasoningEffort": effort });
        }
        self.session_request("session/set_model", params).await
    }

    /// Set one of the agent's advertised `configOptions` (mode, model,
    /// reasoning effort, ...). `value` is a bool for toggles, otherwise the
    /// selected value id.
    pub async fn set_config_option(
        &self,
        config_id: &str,
        value: &Value,
    ) -> Result<Value, String> {
        // The value object is flattened into the request per the ACP schema:
        // `{"type":"boolean","value":true}` for toggles, `{"value":"id"}` for selects.
        let mut params = json!({ "configId": config_id });
        let obj = params.as_object_mut().expect("object");
        match value {
            Value::Bool(b) => {
                obj.insert("type".into(), json!("boolean"));
                obj.insert("value".into(), json!(b));
            }
            other => {
                obj.insert("value".into(), other.clone());
            }
        }
        self.session_request("session/set_config_option", params)
            .await
    }

    /// Issue a request that needs the active `sessionId` injected.
    async fn session_request(&self, method: &str, mut params: Value) -> Result<Value, String> {
        let session_id = self
            .session_id
            .lock()
            .await
            .clone()
            .ok_or("no active ACP session")?;
        if let Some(obj) = params.as_object_mut() {
            obj.insert("sessionId".into(), json!(session_id));
        }
        self.request(method, params).await
    }

    pub async fn authenticate(&self, method_id: &str) -> Result<(), String> {
        self.request("authenticate", json!({ "methodId": method_id }))
            .await
            .map(|_| ())
    }

    /// Send a user turn. Resolves when the agent finishes the turn; streamed
    /// output arrives meanwhile as `session/update` events.
    pub async fn prompt(&self, text: &str) -> Result<Value, String> {
        self.session_request(
            "session/prompt",
            json!({ "prompt": [{ "type": "text", "text": text }] }),
        )
        .await
    }

    pub async fn cancel(&self) -> Result<(), String> {
        let Some(session_id) = self.session_id.lock().await.clone() else {
            return Ok(());
        };
        self.notify("session/cancel", json!({ "sessionId": session_id }))
            .await
    }

    /// Answer a `session/request_permission` the agent is blocked on.
    /// `option_id == None` means the user dismissed the request.
    pub fn respond_permission(&self, request_id: &str, option_id: Option<String>) -> Result<(), String> {
        let (_, tx) = self
            .pending_permissions
            .remove(request_id)
            .ok_or_else(|| format!("unknown permission request: {request_id}"))?;
        let outcome = match option_id {
            Some(id) => json!({ "outcome": "selected", "optionId": id }),
            None => json!({ "outcome": "cancelled" }),
        };
        let _ = tx.send(json!({ "outcome": outcome }));
        Ok(())
    }

    pub async fn kill(&self) {
        let _ = self.child.lock().await.kill().await;
    }

    // --- JSON-RPC plumbing ---

    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.insert(id, tx);
        if let Err(e) = self
            .write(json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }))
            .await
        {
            self.pending.remove(&id);
            return Err(e);
        }
        rx.await.map_err(|_| "agent connection closed".to_string())?
    }

    async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        self.write(json!({ "jsonrpc": "2.0", "method": method, "params": params }))
            .await
    }

    async fn write(&self, msg: Value) -> Result<(), String> {
        let mut line = msg.to_string();
        line.push('\n');
        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        stdin.flush().await.map_err(|e| e.to_string())
    }

    fn emit(&self, mut payload: Value) {
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("connectionId".into(), json!(self.connection_id));
            obj.insert("agentId".into(), json!(self.agent_id));
        }
        self.sink.emit(ACP_EVENT, payload);
    }

    async fn handle_incoming(self: &Arc<Self>, msg: Value) {
        let method = msg.get("method").and_then(Value::as_str);
        let id = msg.get("id").cloned();

        match (method, id) {
            // Response to one of our requests.
            (None, Some(id)) => {
                let Some(id) = id.as_i64() else { return };
                let Some((_, tx)) = self.pending.remove(&id) else {
                    return;
                };
                let result = if let Some(err) = msg.get("error") {
                    let message = err
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("agent error");
                    // Agents put the actionable reason in `data.details`
                    // behind a generic "Internal error" message.
                    let details = err
                        .get("data")
                        .and_then(|d| d.get("details"))
                        .and_then(Value::as_str);
                    Err(match details {
                        Some(details) => format!("{message}: {details}"),
                        None => message.to_string(),
                    })
                } else {
                    Ok(msg.get("result").cloned().unwrap_or(Value::Null))
                };
                let _ = tx.send(result);
            }
            // Notification from the agent.
            (Some(method), None) => {
                let params = msg.get("params").cloned().unwrap_or(Value::Null);
                if method == "session/update" {
                    self.emit(json!({
                        "kind": "update",
                        "sessionId": params.get("sessionId"),
                        "update": params.get("update"),
                    }));
                } else {
                    self.emit(json!({ "kind": "notification", "method": method, "params": params }));
                }
            }
            // Request from the agent — must be answered.
            (Some(method), Some(id)) => {
                let params = msg.get("params").cloned().unwrap_or(Value::Null);
                let this = self.clone();
                let method = method.to_string();
                tokio::spawn(async move {
                    match this.handle_request(&method, params, &id).await {
                        Ok(Some(result)) => {
                            let _ = this
                                .write(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
                                .await;
                        }
                        // Answered asynchronously (permission prompts).
                        Ok(None) => {}
                        Err(message) => {
                            let _ = this
                                .write(json!({
                                    "jsonrpc": "2.0",
                                    "id": id,
                                    "error": { "code": -32603, "message": message }
                                }))
                                .await;
                        }
                    }
                });
            }
            (None, None) => {}
        }
    }

    /// `Ok(None)` means the reply will be written later by another task.
    async fn handle_request(
        self: &Arc<Self>,
        method: &str,
        params: Value,
        id: &Value,
    ) -> Result<Option<Value>, String> {
        match method {
            "fs/read_text_file" => {
                let path = params
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or("fs/read_text_file: missing path")?;
                let content = tokio::fs::read_to_string(path)
                    .await
                    .map_err(|e| format!("{path}: {e}"))?;
                // Optional windowing, 1-based line numbers per the spec.
                let line = params.get("line").and_then(Value::as_u64);
                let limit = params.get("limit").and_then(Value::as_u64);
                let content = if line.is_some() || limit.is_some() {
                    let start = line.unwrap_or(1).saturating_sub(1) as usize;
                    let lines: Vec<&str> = content.lines().skip(start).collect();
                    let lines = match limit {
                        Some(n) => lines.into_iter().take(n as usize).collect::<Vec<_>>(),
                        None => lines,
                    };
                    lines.join("\n")
                } else {
                    content
                };
                Ok(Some(json!({ "content": content })))
            }
            "fs/write_text_file" => {
                let path = params
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or("fs/write_text_file: missing path")?;
                let content = params
                    .get("content")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if let Some(parent) = std::path::Path::new(path).parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }
                tokio::fs::write(path, content)
                    .await
                    .map_err(|e| format!("{path}: {e}"))?;
                Ok(Some(Value::Null))
            }
            "session/request_permission" => {
                let request_id = format!("{}-{}", self.connection_id, id);
                let (tx, rx) = oneshot::channel();
                self.pending_permissions.insert(request_id.clone(), tx);
                self.emit(json!({
                    "kind": "permission",
                    "requestId": request_id,
                    "toolCall": params.get("toolCall"),
                    "options": params.get("options"),
                }));

                let this = self.clone();
                let id = id.clone();
                tokio::spawn(async move {
                    let result = rx
                        .await
                        .unwrap_or_else(|_| json!({ "outcome": { "outcome": "cancelled" } }));
                    let _ = this
                        .write(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
                        .await;
                });
                Ok(None)
            }
            other => Err(format!("unsupported client method: {other}")),
        }
    }
}
