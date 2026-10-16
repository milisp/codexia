use std::process::Stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::time::Duration;

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

/// How a connection behaves beyond plain JSON-RPC plumbing. The default is an
/// interactive session with no extra servers, which is what every non-bot
/// connection gets.
#[derive(Clone, Default)]
pub struct ConnectionPolicy {
    /// Require keke's ACP-only client MCP policy and verify it during initialize.
    /// This stays off for ordinary ACP connections.
    pub strict_mcp: bool,
    /// ACP `McpServer` entries handed to every `session/new` and `session/load`.
    pub mcp_servers: Vec<Value>,
    /// Refuse the agent's `fs/write_text_file` requests. The agent's own
    /// sandbox only covers what it writes itself; a write it routes through
    /// the client would otherwise bypass a read-only bot's sandbox entirely.
    pub read_only: bool,
    /// Answer permission requests here instead of asking a person. Set for
    /// runs nobody is watching, where an unanswered request would hang the
    /// turn until it timed out.
    pub unattended: Option<UnattendedApprovals>,
    /// Tools (keke ids) allowed without asking, watched or not: Codexia's own
    /// tools that only leave something for the person to review. A request
    /// keke marks as person-required is still put in front of a person.
    pub auto_allow: Vec<String>,
}

impl ConnectionPolicy {
    /// The answer for a request this policy allows on its own.
    fn auto_answer(&self, params: &Value) -> Option<Value> {
        (!person_required(params) && self.auto_allow.contains(&approval_key(params)))
            .then(|| select(params, "allow_once"))
    }

    fn revoke_delegation(&self) {
        for server in &self.mcp_servers {
            if server["name"] == "codexia-bots"
                && let Some(headers) = server["headers"].as_array()
            {
                for header in headers {
                    if header["name"] == "X-Codexia-Delegation" {
                        crate::delegation::revoke(header["value"].as_str().unwrap_or_default());
                    }
                }
            }
        }
    }
}

/// How long an unattended request waits for a person before it is refused.
/// Long enough to cover a night's sleep; a run waiting this long has been
/// abandoned, and holding its process open forever would hide that.
pub const PERSON_WAIT: Duration = Duration::from_secs(12 * 60 * 60);

/// Whether keke marked this request as one only a person may answer, once.
/// A keke extension (`_meta["keke.dev/person-required"]`), not a standard ACP
/// field; anything other than `true` is an ordinary request.
pub fn person_required(params: &Value) -> bool {
    params
        .get("_meta")
        .and_then(|meta| meta.get("keke.dev/person-required"))
        .and_then(Value::as_bool)
        == Some(true)
}

/// The standing answer for permission requests on an unattended connection.
#[derive(Clone, Default)]
pub struct UnattendedApprovals {
    /// Allow everything a standing answer may cover — an autonomous bot.
    /// Never covers a request only a person may answer.
    pub allow_all: bool,
    /// Tool keys (see [`approval_key`]) a person approved for good.
    pub approved_tools: Vec<String>,
    /// Set once any request was refused, or went unanswered, so the run can
    /// report that it was blocked rather than claim it finished its job.
    pub blocked: Arc<AtomicBool>,
    /// Requests currently waiting for a person.
    pub waiting: Arc<WaitClock>,
}

/// `_meta` key on a stored user turn that came from a routine or another bot.
pub const TRIGGER_META: &str = "codexia.dev/trigger";

/// keke's `_meta` name for the tool a permission request is about.
const TOOL_META: &str = "keke.dev/tool";

/// What a standing approval is keyed on: the tool id keke names in `_meta`,
/// else the ACP kind, else the title. ACP's `other` is never a key — it is the
/// kind of every MCP tool, so approving it would approve all of them at once.
pub fn approval_key(params: &Value) -> String {
    let tool = params.get("toolCall");
    let named = params
        .get("_meta")
        .and_then(|m| m.get(TOOL_META))
        .and_then(Value::as_str);
    let kind = tool
        .and_then(|t| t.get("kind"))
        .and_then(Value::as_str)
        .filter(|k| *k != "other");
    let title = || tool.and_then(|t| t.get("title")).and_then(Value::as_str);
    named.or(kind).or_else(title).unwrap_or_default().to_string()
}

/// What an unattended connection does with one permission request.
#[derive(Debug, PartialEq)]
enum Standing {
    /// Answered from the bot's standing approvals.
    Answer(Value),
    /// Nobody may answer for the person: park it until they do.
    AskPerson,
}

impl UnattendedApprovals {
    fn standing(&self, params: &Value) -> Standing {
        if person_required(params) {
            return Standing::AskPerson;
        }
        let key = approval_key(params);
        if self.allow_all || self.approved_tools.contains(&key) {
            return Standing::Answer(select(params, "allow_once"));
        }
        Standing::AskPerson
    }
}

/// Counts requests waiting for a person and the time spent waiting, so an
/// unattended run can stop its own clock while nobody is there to answer.
#[derive(Default)]
pub struct WaitClock {
    state: std::sync::Mutex<WaitState>,
    /// Told `true` when the first request starts waiting and `false` when the
    /// last one is answered.
    on_change: std::sync::OnceLock<Box<dyn Fn(bool) + Send + Sync>>,
}

#[derive(Default)]
struct WaitState {
    open: usize,
    since: Option<tokio::time::Instant>,
    total: Duration,
}

impl WaitClock {
    pub fn on_change(&self, f: impl Fn(bool) + Send + Sync + 'static) {
        let _ = self.on_change.set(Box::new(f));
    }

    /// Total time spent with at least one request waiting, including now.
    pub fn waited(&self) -> Duration {
        let state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        state.total + state.since.map(|s| s.elapsed()).unwrap_or_default()
    }

    pub fn is_waiting(&self) -> bool {
        self.state.lock().unwrap_or_else(|e| e.into_inner()).open > 0
    }

    #[cfg(test)]
    pub(crate) fn start_for_test(&self) {
        self.start();
    }

    #[cfg(test)]
    pub(crate) fn end_for_test(&self) {
        self.end();
    }

    fn start(&self) {
        let first = {
            let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            state.open += 1;
            if state.open == 1 {
                state.since = Some(tokio::time::Instant::now());
            }
            state.open == 1
        };
        if first && let Some(f) = self.on_change.get() {
            f(true);
        }
    }

    fn end(&self) {
        let last = {
            let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            state.open = state.open.saturating_sub(1);
            if state.open == 0 {
                if let Some(since) = state.since.take() {
                    state.total += since.elapsed();
                }
                true
            } else {
                false
            }
        };
        if last && let Some(f) = self.on_change.get() {
            f(false);
        }
    }
}

/// Answer `params` with its first option of `kind`, or cancel when it offers
/// none.
fn select(params: &Value, kind: &str) -> Value {
    let option = params
        .get("options")
        .and_then(Value::as_array)
        .and_then(|options| {
            options
                .iter()
                .find(|o| o.get("kind").and_then(Value::as_str) == Some(kind))
        })
        .and_then(|o| o.get("optionId"))
        .cloned();
    match option {
        Some(id) => json!({ "outcome": { "outcome": "selected", "optionId": id } }),
        None => json!({ "outcome": { "outcome": "cancelled" } }),
    }
}

/// Whether a reply to `params` let the call go ahead.
fn allowed(params: &Value, reply: &Value) -> bool {
    let Some(chosen) = reply["outcome"]["optionId"].as_str() else {
        return false;
    };
    params
        .get("options")
        .and_then(Value::as_array)
        .and_then(|options| {
            options
                .iter()
                .find(|o| o.get("optionId").and_then(Value::as_str) == Some(chosen))
        })
        .and_then(|o| o.get("kind"))
        .and_then(Value::as_str)
        .is_some_and(|kind| kind.starts_with("allow"))
}

type Pending = Arc<DashMap<i64, oneshot::Sender<Result<Value, String>>>>;

impl Drop for AcpClient {
    fn drop(&mut self) {
        self.revoke_delegation();
    }
}

pub struct AcpClient {
    pub connection_id: String,
    pub agent_id: String,
    /// Display name of the agent, stored alongside persisted sessions.
    pub agent_name: String,
    /// The bot this process was started for, when it was started from the Bot
    /// tab. Every session it opens is tagged with it, which is what keeps a
    /// bot's conversations out of the per-project session lists.
    pub bot_id: Option<String>,
    policy: ConnectionPolicy,
    delegation_tokens: DashMap<String, ()>,
    /// Sessions opened on this connection, keyed by ACP session id. One agent
    /// process can host several sessions at once.
    sessions: Arc<DashMap<String, ()>>,
    /// Most recently opened session, used when a call omits the session id.
    last_session: Mutex<Option<String>>,
    /// Sessions whose stored transcript `session/load` is replaying right now,
    /// so the replayed updates are not persisted again.
    replaying: Arc<DashMap<String, ()>>,
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    next_id: AtomicI64,
    pending: Pending,
    /// JSON-RPC id of an in-flight `session/request_permission`, keyed by the
    /// request id we hand to the frontend.
    pending_permissions: Arc<DashMap<String, oneshot::Sender<Value>>>,
    /// What each unattended request waiting for a person looks like, as it
    /// was announced, so a client that was not listening can still list it.
    waiting_requests: Arc<DashMap<String, Value>>,
    sink: Arc<dyn EventSink>,
}

impl AcpClient {
    /// Spawn the agent process and run the ACP handshake (`initialize`).
    /// Does not create a session yet — see [`AcpClient::new_session`].
    pub async fn spawn(
        connection_id: String,
        agent: &AcpAgentDef,
        cwd: Option<&str>,
        bot_id: Option<String>,
        policy: ConnectionPolicy,
        sink: Arc<dyn EventSink>,
    ) -> Result<(Arc<Self>, Value), String> {
        let mut cmd = Command::new(&agent.command);
        cmd.args(&agent.args);
        if policy.strict_mcp {
            // Appended to the resolved launcher: bundled, PATH and npx all
            // receive the same agent option. Older agents must fail closed.
            cmd.args(["--mcp-policy", "client-only"]);
        }
        cmd.envs(&agent.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }

        let mut child = cmd.spawn().map_err(|e| {
            policy.revoke_delegation();
            format!("failed to spawn `{}`: {e}", agent.command)
        })?;
        let stdin = child.stdin.take().ok_or("failed to open agent stdin")?;
        let stdout = child.stdout.take().ok_or("failed to open agent stdout")?;
        let stderr = child.stderr.take().ok_or("failed to open agent stderr")?;

        let client = Arc::new(Self {
            connection_id: connection_id.clone(),
            agent_id: agent.id.clone(),
            agent_name: agent.name.clone(),
            bot_id,
            policy,
            delegation_tokens: DashMap::new(),
            sessions: Arc::new(DashMap::new()),
            last_session: Mutex::new(None),
            replaying: Arc::new(DashMap::new()),
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            next_id: AtomicI64::new(1),
            pending: Arc::new(DashMap::new()),
            pending_permissions: Arc::new(DashMap::new()),
            waiting_requests: Arc::new(DashMap::new()),
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
                client.revoke_delegation();
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
                    // debug! is silent in a release build's log file, which is
                    // exactly where an agent's own crash reason is needed most.
                    log::info!("acp stderr: {line}");
                    client.emit(json!({ "kind": "stderr", "line": line }));
                }
            });
        }

        let initialize = client.request(
            "initialize",
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "clientCapabilities": {
                    "fs": { "readTextFile": true, "writeTextFile": true },
                    "terminal": false
                },
                "clientInfo": { "name": "codexia", "version": env!("CARGO_PKG_VERSION") }
            }),
        );
        let init = if client.policy.strict_mcp {
            tokio::time::timeout(std::time::Duration::from_secs(120), initialize)
                .await
                .unwrap_or_else(|_| Err("ACP initialize timed out".into()))
        } else {
            initialize.await
        };
        let init = init.and_then(|init| {
            validate_mcp_policy(&client.policy, &init)?;
            Ok(init)
        });
        let init = match init {
            Ok(init) => init,
            Err(error) => {
                client.kill().await;
                return Err(if client.policy.strict_mcp {
                    format!("Bot requires keke strict MCP isolation (--mcp-policy client-only) and require_approval support: {error}. Update keke to a version that confirms both during ACP initialize.")
                } else { error });
            }
        };

        Ok((client, init))
    }

    /// Returns the full `session/new` result: besides `sessionId` it carries
    /// `modes`, `models` and `configOptions`, which drive the session controls.
    pub async fn new_session(&self, cwd: &str) -> Result<Value, String> {
        let (servers, capabilities) = self.session_mcp_servers();
        let res = self
            .request(
                "session/new",
                json!({ "cwd": cwd, "mcpServers": servers }),
            )
            .await?;
        let session_id = res
            .get("sessionId")
            .and_then(Value::as_str)
            .ok_or("session/new returned no sessionId")?
            .to_string();
        for token in &capabilities {
            crate::delegation::bind(token, &session_id);
        }
        self.track_session(session_id.clone()).await;
        if let Err(e) = codexia_db::acp_sessions::upsert_session(
            &session_id,
            &self.agent_id,
            Some(&self.agent_name),
            cwd,
            self.bot_id.as_deref(),
        ) {
            log::warn!("acp: failed to record session: {e}");
        }
        Ok(res)
    }

    /// Resume a previous session. Only agents whose `initialize` result sets
    /// `agentCapabilities.loadSession` support this; the others must be given
    /// the stored transcript as read-only history instead.
    pub async fn load_session(&self, session_id: &str, cwd: &str) -> Result<Value, String> {
        let (servers, capabilities) = self.session_mcp_servers();
        for token in &capabilities {
            crate::delegation::bind(token, session_id);
        }
        // The replay arrives as ordinary `session/update` notifications, which
        // are already stored — don't write them a second time.
        self.replaying.insert(session_id.to_string(), ());
        let res = self
            .request(
                "session/load",
                json!({ "sessionId": session_id, "cwd": cwd, "mcpServers": servers }),
            )
            .await;
        self.replaying.remove(session_id);
        let res = res?;
        self.track_session(session_id.to_string()).await;
        if let Err(e) = codexia_db::acp_sessions::upsert_session(
            session_id,
            &self.agent_id,
            Some(&self.agent_name),
            cwd,
            self.bot_id.as_deref(),
        ) {
            log::warn!("acp: failed to record session: {e}");
        }
        Ok(res)
    }

    /// Whether `session_id` was opened on this connection.
    pub fn has_session(&self, session_id: &str) -> bool {
        self.sessions.contains_key(session_id)
    }

    /// Remember a session and make it the default for calls that omit an id.
    async fn track_session(&self, session_id: String) {
        self.sessions.insert(session_id.clone(), ());
        *self.last_session.lock().await = Some(session_id);
    }

    /// Resolve the session a call targets: the given id when it belongs to this
    /// connection, otherwise the most recently opened one.
    pub async fn resolve_session(&self, session_id: Option<&str>) -> Result<String, String> {
        match session_id {
            Some(id) if self.sessions.contains_key(id) => Ok(id.to_string()),
            Some(id) => Err(format!("unknown ACP session: {id}")),
            None => self
                .last_session
                .lock()
                .await
                .clone()
                .ok_or_else(|| "no active ACP session".to_string()),
        }
    }

    pub async fn set_mode(&self, session_id: Option<&str>, mode_id: &str) -> Result<Value, String> {
        self.session_request(session_id, "session/set_mode", json!({ "modeId": mode_id }))
            .await
    }

    /// `reasoning_effort` rides along in `_meta`: agents that advertise
    /// per-model efforts (Grok) read it there, others ignore it.
    pub async fn set_model(
        &self,
        session_id: Option<&str>,
        model_id: &str,
        reasoning_effort: Option<&str>,
    ) -> Result<Value, String> {
        let mut params = json!({ "modelId": model_id });
        if let Some(effort) = reasoning_effort {
            params["_meta"] = json!({ "reasoningEffort": effort });
        }
        self.session_request(session_id, "session/set_model", params)
            .await
    }

    /// Set one of the agent's advertised `configOptions` (mode, model,
    /// reasoning effort, ...). `value` is a bool for toggles, otherwise the
    /// selected value id.
    pub async fn set_config_option(
        &self,
        session_id: Option<&str>,
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
        self.session_request(session_id, "session/set_config_option", params)
            .await
    }

    /// Issue a request that needs a `sessionId` injected.
    async fn session_request(
        &self,
        session_id: Option<&str>,
        method: &str,
        mut params: Value,
    ) -> Result<Value, String> {
        let session_id = self.resolve_session(session_id).await?;
        if let Some(obj) = params.as_object_mut() {
            obj.insert("sessionId".into(), json!(session_id));
        }
        self.request(method, params).await
    }

    pub async fn authenticate(&self, method_id: &str) -> Result<(), String> {
        self.request(
            "authenticate",
            json!({ "methodId": method_id, "_meta": { "persist": false } }),
        )
        .await
        .map(|_| ())
    }

    /// Send a user turn. Resolves when the agent finishes the turn; streamed
    /// output arrives meanwhile as `session/update` events.
    pub async fn prompt(&self, session_id: Option<&str>, text: &str) -> Result<Value, String> {
        self.prompt_from(session_id, text, None).await
    }

    /// [`Self::prompt`] for a turn nobody typed: `trigger` (a routine, another
    /// bot) is kept on the stored turn as `_meta["codexia.dev/trigger"]`, so the
    /// conversation can show where it came from instead of a message from you.
    pub async fn prompt_from(
        &self,
        session_id: Option<&str>,
        text: &str,
        trigger: Option<Value>,
    ) -> Result<Value, String> {
        let session_id = self.resolve_session(session_id).await?;
        // The agent never echoes the user's turn back, so record it here to
        // keep the persisted transcript complete.
        let mut turn = json!({
            "sessionUpdate": "user_message_chunk",
            "content": { "type": "text", "text": text }
        });
        if let Some(trigger) = trigger {
            turn["_meta"] = json!({ TRIGGER_META: trigger });
        }
        self.persist(&session_id, &turn);
        if let Err(e) = codexia_db::acp_sessions::set_title_if_empty(&session_id, text) {
            log::warn!("acp: failed to set session title: {e}");
        }
        self.session_request(
            Some(&session_id),
            "session/prompt",
            json!({ "prompt": [{ "type": "text", "text": text }] }),
        )
        .await
    }

    pub async fn cancel(&self, session_id: Option<&str>) -> Result<(), String> {
        let Ok(session_id) = self.resolve_session(session_id).await else {
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
        self.revoke_delegation();
        let _ = self.child.lock().await.kill().await;
    }

    /// The servers to hand a new or loaded session, with a fresh
    /// `codexia-bots` capability each time, plus those capabilities so the
    /// caller can bind them to the session id.
    fn session_mcp_servers(&self) -> (Vec<Value>, Vec<String>) {
        let mut issued = Vec::new();
        let mut servers = self.policy.mcp_servers.clone();
        for server in &mut servers {
            if server["name"] != "codexia-bots" {
                continue;
            }
            let Some(caller) = self.bot_id.as_deref() else { continue };
            let Some(headers) = server["headers"].as_array_mut() else { continue };
            for header in headers {
                if header["name"] == "X-Codexia-Delegation" {
                    let template = header["value"].as_str().unwrap_or_default();
                    if let Some(grant) = crate::delegation::grant(template, caller) {
                        let token = crate::delegation::issue(caller, grant.ask);
                        self.delegation_tokens.insert(token.clone(), ());
                        header["value"] = json!(token);
                        issued.push(token);
                    }
                }
            }
        }
        (servers, issued)
    }

    fn revoke_delegation(&self) {
        for token in &self.delegation_tokens {
            crate::delegation::revoke(token.key());
        }
        self.policy.revoke_delegation();
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

    /// Append a `session/update` payload to the stored transcript. Storage is
    /// best effort: a failure here must not break the live session.
    fn persist(&self, session_id: &str, update: &Value) {
        if self.replaying.contains_key(session_id) {
            return;
        }
        if let Err(e) = codexia_db::acp_sessions::append_update(session_id, &update.to_string()) {
            log::warn!("acp: failed to persist session update: {e}");
        }
    }

    /// Put a permission request in front of a person and answer the agent
    /// once they do. On an unattended connection the request is also listed
    /// for clients that were not watching, waits at most [`PERSON_WAIT`], and
    /// any outcome other than an allow marks the run as blocked.
    fn ask_person(self: &Arc<Self>, params: Value, id: Value, unattended: Option<UnattendedApprovals>) {
        let request_id = format!("{}-{}", self.connection_id, id);
        let (tx, rx) = oneshot::channel();
        self.pending_permissions.insert(request_id.clone(), tx);
        let announced = json!({
            "kind": "permission",
            "requestId": request_id,
            "sessionId": params.get("sessionId"),
            "toolCall": params.get("toolCall"),
            "options": params.get("options"),
            "personRequired": person_required(&params),
            "approvalKey": approval_key(&params),
            "unattended": unattended.is_some(),
            "botId": self.bot_id,
            "requestedAt": chrono::Utc::now().to_rfc3339(),
        });
        if unattended.is_some() {
            let mut listed = announced.clone();
            if let Some(obj) = listed.as_object_mut() {
                obj.insert("connectionId".into(), json!(self.connection_id));
            }
            self.waiting_requests.insert(request_id.clone(), listed);
        }
        self.emit(announced);

        let this = self.clone();
        tokio::spawn(async move {
            let cancelled = || json!({ "outcome": { "outcome": "cancelled" } });
            let result = match &unattended {
                Some(unattended) => {
                    unattended.waiting.start();
                    let result = match tokio::time::timeout(PERSON_WAIT, rx).await {
                        Ok(answer) => answer.unwrap_or_else(|_| cancelled()),
                        Err(_) => {
                            this.pending_permissions.remove(&request_id);
                            select(&params, "reject_once")
                        }
                    };
                    this.waiting_requests.remove(&request_id);
                    if !allowed(&params, &result) {
                        unattended.blocked.store(true, Ordering::Relaxed);
                    }
                    unattended.waiting.end();
                    result
                }
                None => rx.await.unwrap_or_else(|_| cancelled()),
            };
            let _ = this
                .write(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
                .await;
        });
    }

    /// Unattended requests on this connection still waiting for a person.
    pub fn waiting_requests(&self) -> Vec<Value> {
        self.waiting_requests.iter().map(|e| e.value().clone()).collect()
    }

    fn emit(&self, mut payload: Value) {
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("connectionId".into(), json!(self.connection_id));
            obj.insert("agentId".into(), json!(self.agent_id));
            if let Some(bot_id) = &self.bot_id {
                obj.insert("botId".into(), json!(bot_id));
            }
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
                    // Agents put the actionable reason behind a generic
                    // "Internal error" message, either as `data.details` or,
                    // as keke does, as `data` itself being the reason string.
                    let details = err.get("data").and_then(|d| {
                        d.get("details")
                            .and_then(Value::as_str)
                            .or_else(|| d.as_str())
                    });
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
                    let session_id = params.get("sessionId").and_then(Value::as_str);
                    if let (Some(session_id), Some(update)) = (session_id, params.get("update")) {
                        self.persist(session_id, update);
                    }
                    // A `session/load` replay repeats what is already stored;
                    // a client following the live transcript must skip it.
                    let replay = session_id.is_some_and(|id| self.replaying.contains_key(id));
                    self.emit(json!({
                        "kind": "update",
                        "replay": replay,
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
                if self.policy.read_only {
                    return Err("this agent is read-only: writing files is not allowed".to_string());
                }
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
                if let Some(answer) = self.policy.auto_answer(&params) {
                    return Ok(Some(answer));
                }
                let unattended = self.policy.unattended.clone();
                if let Some(unattended) = &unattended
                    && let Standing::Answer(answer) = unattended.standing(&params)
                {
                    return Ok(Some(answer));
                }
                self.ask_person(params, id.clone(), unattended);
                Ok(None)
            }
            other => Err(format!("unsupported client method: {other}")),
        }
    }
}

fn validate_mcp_policy(policy: &ConnectionPolicy, init: &Value) -> Result<(), String> {
    if policy.strict_mcp
        && init.get("_meta").and_then(|meta| meta.get("keke.dev/mcp-policy"))
            .and_then(Value::as_str) != Some("client-only")
    {
        return Err("runtime did not confirm client-only MCP policy; refusing to open a Bot session".into());
    }
    // Bots rely on keke to mark requests only a person may answer; without
    // that an unattended run could approve a payment from a standing rule.
    if policy.strict_mcp
        && init.get("_meta").and_then(|meta| meta.get("keke.dev/require-approval"))
            .and_then(Value::as_bool) != Some(true)
    {
        return Err("runtime did not confirm require_approval support; refusing to open a Bot session".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct QuietSink;
    impl EventSink for QuietSink {
        fn emit(&self, _: &str, _: Value) {}
    }

    #[test]
    fn strict_policy_requires_active_confirmation_not_version_or_support_claim() {
        let strict = ConnectionPolicy { strict_mcp: true, ..Default::default() };
        for init in [json!({}), json!({"agentInfo":{"version":"999.0"}}),
            json!({"_meta":{"keke.dev/mcp-policy":"merge"}}),
            json!({"_meta":{"keke.dev/mcp-policy":true}})] {
            assert!(validate_mcp_policy(&strict, &init).is_err());
            assert!(validate_mcp_policy(&ConnectionPolicy::default(), &init).is_ok());
        }
        assert!(validate_mcp_policy(&strict,
            &json!({"_meta":{"keke.dev/mcp-policy":"client-only", "keke.dev/require-approval":true}})).is_ok());
    }

    // The fixture only speaks ACP and inspects launcher arguments. No real
    // agent, credentials, MCP server or database is touched by these tests.
    #[cfg(unix)]
    async fn fixture(policy: ConnectionPolicy, advertised: &str) -> Result<(Arc<AcpClient>, Value), String> {
        fixture_with(policy, advertised, "present").await
    }

    #[cfg(unix)]
    async fn fixture_with(policy: ConnectionPolicy, advertised: &str, require: &str) -> Result<(Arc<AcpClient>, Value), String> {
        let agent = AcpAgentDef {
            id: "fixture".into(), name: "Fixture".into(), command: "python3".into(),
            args: vec!["-u".into(), "-c".into(), r#"
import json, os, sys
for line in sys.stdin:
    msg = json.loads(line)
    if msg['method'] == 'initialize':
        result = {'arguments': sys.argv[1:]}
        if os.environ['POLICY'] != 'absent':
            result['_meta'] = {'keke.dev/mcp-policy': os.environ['POLICY'],
                               'keke.dev/require-approval': os.environ.get('REQUIRE') != 'absent'}
        reply = {'result': result}
    else:
        reply = {'error': {'code': -32603, 'message': json.dumps(msg['params'])}}
    print(json.dumps(dict(jsonrpc='2.0', id=msg['id'], **reply)), flush=True)
"#.into()],
            env: [("POLICY".into(), advertised.into()), ("REQUIRE".into(), require.into())].into(),
            available: true, local: true,
        };
        AcpClient::spawn("fixture".into(), &agent, None, Some("caller".into()), policy, Arc::new(QuietSink)).await
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn older_and_nonisolating_runtimes_fail_before_bot_session_creation() {
        for advertised in ["absent", "merge"] {
            let template = crate::delegation::issue("caller", true);
            let policy = ConnectionPolicy { strict_mcp: true, mcp_servers: vec![json!({
                "name":"codexia-bots", "headers":[{"name":"X-Codexia-Delegation","value":template}]
            })], ..Default::default() };
            let error = match fixture(policy, advertised).await {
                Ok((client, _)) => { client.kill().await; panic!("unsafe runtime accepted"); }
                Err(error) => error,
            };
            assert!(error.contains("Bot requires keke strict MCP isolation"));
            assert!(!crate::delegation::verify(&template, "caller"));
        }
        let (client, init) = fixture(ConnectionPolicy::default(), "absent").await.unwrap();
        assert_eq!(init["arguments"], json!([]));
        client.kill().await;
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn strict_new_and_load_forward_identical_original_names_and_headers() {
        let servers = vec![json!({"name":"native", "type":"sse", "url":"https://example.test/mcp",
            "headers":[{"name":"X-Test","value":"${TEST_HEADER}"}]})];
        let policy = ConnectionPolicy { strict_mcp: true, mcp_servers: servers.clone(), ..Default::default() };
        let (client, init) = fixture(policy, "client-only").await.unwrap();
        assert_eq!(init["arguments"], json!(["--mcp-policy", "client-only"]));
        let new: Value = serde_json::from_str(&client.new_session("/tmp").await.unwrap_err()).unwrap();
        let load: Value = serde_json::from_str(&client.load_session("stored", "/tmp").await.unwrap_err()).unwrap();
        assert_eq!(new["mcpServers"], json!(servers));
        assert_eq!(new["mcpServers"], load["mcpServers"]);
        client.kill().await;
        let (client, _) = fixture(ConnectionPolicy { strict_mcp: true, ..Default::default() }, "client-only").await.unwrap();
        let new: Value = serde_json::from_str(&client.new_session("/tmp").await.unwrap_err()).unwrap();
        assert_eq!(new["mcpServers"], json!([]));
        client.kill().await;
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn strict_sessions_bind_rotate_and_revoke_collaboration_capabilities() {
        let template = crate::delegation::issue("caller", true);
        let policy = ConnectionPolicy { strict_mcp: true, mcp_servers: vec![json!({
            "name":"codexia-bots", "type":"http", "url":"http://127.0.0.1/mcp/bots?from=caller",
            "headers":[{"name":"X-Codexia-Delegation","value":template}]
        })], ..Default::default() };
        let (client, _) = fixture(policy, "client-only").await.unwrap();
        let new: Value = serde_json::from_str(&client.new_session("/tmp").await.unwrap_err()).unwrap();
        let load: Value = serde_json::from_str(&client.load_session("stored", "/tmp").await.unwrap_err()).unwrap();
        let first = new["mcpServers"][0]["headers"][0]["value"].as_str().unwrap();
        let second = load["mcpServers"][0]["headers"][0]["value"].as_str().unwrap();
        assert_ne!(first, second);
        assert_ne!(first, template);
        assert!(crate::delegation::verify(first, "caller"));
        assert!(!crate::delegation::verify(first, "other"));
        client.kill().await;
        for token in [first, second, template.as_str()] {
            assert!(!crate::delegation::verify(token, "caller"));
        }
    }

    fn request(kind: &str) -> Value {
        json!({
            "toolCall": { "kind": kind, "title": "Run a command" },
            "options": [
                { "optionId": "allow", "kind": "allow_once" },
                { "optionId": "deny", "kind": "reject_once" },
            ],
        })
    }

    fn person_only(kind: &str) -> Value {
        let mut request = request(kind);
        request["_meta"] = json!({ "keke.dev/person-required": true });
        request
    }

    #[test]
    fn auto_allowed_tools_skip_the_person_unless_keke_requires_one() {
        let policy = ConnectionPolicy {
            auto_allow: vec!["acp:codexia-bots:propose_draft".into()],
            ..Default::default()
        };
        let mut draft = request("other");
        draft["_meta"] = json!({ "keke.dev/tool": "acp:codexia-bots:propose_draft" });
        assert_eq!(policy.auto_answer(&draft).as_ref().and_then(|a| a["outcome"]["optionId"].as_str()), Some("allow"));
        let mut other = draft.clone();
        other["_meta"]["keke.dev/tool"] = json!("acp:codexia-bots:ask_bot");
        assert!(policy.auto_answer(&other).is_none());
        draft["_meta"]["keke.dev/person-required"] = json!(true);
        assert!(policy.auto_answer(&draft).is_none());
    }

    #[test]
    fn standing_approvals_are_keyed_on_the_tool_never_on_other() {
        let mut shop = request("other");
        shop["toolCall"]["title"] = json!("acp:shop:lookup_price: calls the `shop` MCP server");
        assert_eq!(approval_key(&shop), "acp:shop:lookup_price: calls the `shop` MCP server");
        shop["_meta"] = json!({ "keke.dev/tool": "acp:shop:lookup_price" });
        assert_eq!(approval_key(&shop), "acp:shop:lookup_price");
        assert_eq!(approval_key(&request("execute")), "execute");

        // A bot that once saved the coarse `other` key does not get every MCP tool.
        let legacy = UnattendedApprovals { approved_tools: vec!["other".into()], ..Default::default() };
        assert_eq!(legacy.standing(&shop), Standing::AskPerson);
        let exact = UnattendedApprovals {
            approved_tools: vec!["acp:shop:lookup_price".into()],
            ..Default::default()
        };
        assert_eq!(answered(exact.standing(&shop)).as_deref(), Some("allow"));
        let mut send = shop.clone();
        send["_meta"]["keke.dev/tool"] = json!("acp:gmail:send_email");
        assert_eq!(exact.standing(&send), Standing::AskPerson);
    }

    fn answered(standing: Standing) -> Option<String> {
        match standing {
            Standing::Answer(answer) => answer["outcome"]["optionId"].as_str().map(str::to_string),
            Standing::AskPerson => None,
        }
    }

    #[test]
    fn unattended_answers_only_from_standing_approvals_and_asks_otherwise() {
        let approvals = UnattendedApprovals {
            approved_tools: vec!["read".into()],
            ..Default::default()
        };
        assert_eq!(answered(approvals.standing(&request("read"))).as_deref(), Some("allow"));
        // Not approved: a person decides; nothing is refused on their behalf.
        assert_eq!(approvals.standing(&request("execute")), Standing::AskPerson);
        assert!(!approvals.blocked.load(Ordering::Relaxed));
    }

    #[test]
    fn nothing_standing_answers_a_request_only_a_person_may_answer() {
        let approvals = UnattendedApprovals {
            allow_all: true,
            approved_tools: vec!["execute".into()],
            ..Default::default()
        };
        assert_eq!(answered(approvals.standing(&request("execute"))).as_deref(), Some("allow"));
        assert_eq!(approvals.standing(&person_only("execute")), Standing::AskPerson);
        // Only a literal `true` marks it; anything else is an ordinary request.
        let mut odd = request("execute");
        odd["_meta"] = json!({ "keke.dev/person-required": "true" });
        assert!(!person_required(&odd));
    }

    #[test]
    fn only_an_allow_option_counts_as_allowed() {
        let params = request("execute");
        assert!(allowed(&params, &select(&params, "allow_once")));
        assert!(!allowed(&params, &select(&params, "reject_once")));
        assert!(!allowed(&params, &json!({ "outcome": { "outcome": "cancelled" } })));
        assert_eq!(select(&json!({ "options": [] }), "reject_once")["outcome"]["outcome"], "cancelled");
    }

    #[test]
    fn the_wait_clock_reports_edges_and_accumulates() {
        let clock = WaitClock::default();
        let seen = Arc::new(std::sync::Mutex::new(Vec::new()));
        let log = Arc::clone(&seen);
        clock.on_change(move |waiting| log.lock().unwrap().push(waiting));
        clock.start();
        clock.start();
        assert!(clock.is_waiting());
        std::thread::sleep(Duration::from_millis(20));
        clock.end();
        assert!(clock.is_waiting());
        clock.end();
        assert!(!clock.is_waiting());
        assert!(clock.waited() >= Duration::from_millis(20));
        assert_eq!(*seen.lock().unwrap(), vec![true, false]);
    }

    #[test]
    fn strict_policy_requires_approval_rule_support() {
        let strict = ConnectionPolicy { strict_mcp: true, ..Default::default() };
        let isolated = json!({"_meta":{"keke.dev/mcp-policy":"client-only"}});
        assert!(validate_mcp_policy(&strict, &isolated).is_err());
        assert!(validate_mcp_policy(&strict, &json!({"_meta":{
            "keke.dev/mcp-policy":"client-only", "keke.dev/require-approval": true}})).is_ok());
        assert!(validate_mcp_policy(&ConnectionPolicy::default(), &isolated).is_ok());
    }

    /// A fixture agent that asks for permission once, right after
    /// initialize, and writes the answer it got to `out`. Standing in for keke
    /// on an unattended connection without opening a session (which would
    /// touch the session database).
    #[cfg(unix)]
    async fn asking_fixture(
        unattended: UnattendedApprovals,
        meta: Value,
        out: &std::path::Path,
    ) -> Arc<AcpClient> {
        let agent = AcpAgentDef {
            id: "asker".into(), name: "Asker".into(), command: "python3".into(),
            args: vec!["-u".into(), "-c".into(), r#"
import json, os, sys
meta = json.loads(os.environ['META'])
msg = json.loads(sys.stdin.readline())
print(json.dumps({'jsonrpc':'2.0','id':msg['id'],'result':{}}), flush=True)
ask = {'jsonrpc':'2.0','id':900,'method':'session/request_permission','params':{
    'sessionId':'s1','toolCall':{'kind':'execute','title':'pay'},
    'options':[{'optionId':'allow','kind':'allow_once'},{'optionId':'deny','kind':'reject_once'}]}}
if meta: ask['params']['_meta'] = meta
print(json.dumps(ask), flush=True)
reply = sys.stdin.readline()
with open(os.environ['OUT'], 'w') as f:
    f.write(reply)
sys.stdin.read()
"#.into()],
            env: [
                ("META".into(), meta.to_string()),
                ("OUT".into(), out.to_string_lossy().into_owned()),
            ].into(),
            available: true, local: true,
        };
        let policy = ConnectionPolicy { unattended: Some(unattended), ..Default::default() };
        AcpClient::spawn("asker".into(), &agent, None, Some("bot-1".into()), policy, Arc::new(QuietSink))
            .await
            .unwrap()
            .0
    }

    #[cfg(unix)]
    async fn first_waiting(client: &AcpClient) -> Value {
        for _ in 0..250 {
            if let Some(first) = client.waiting_requests().first() {
                return first.clone();
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("no request started waiting");
    }

    #[cfg(unix)]
    async fn told(out: &std::path::Path) -> Value {
        for _ in 0..250 {
            if let Ok(text) = std::fs::read_to_string(out)
                && !text.is_empty()
            {
                return serde_json::from_str::<Value>(&text).unwrap()["result"].clone();
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("the agent was never answered");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn an_unattended_request_waits_for_a_person_and_is_listed_meanwhile() {
        let dir = std::env::temp_dir().join(format!("codexia-acp-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let out = dir.join("told.json");
        let approvals = UnattendedApprovals { allow_all: true, ..Default::default() };
        let client = asking_fixture(approvals.clone(), json!({"keke.dev/person-required": true}), &out).await;
        // Autonomous does not answer it: it waits, listed, until a person does.
        let listed = first_waiting(&client).await;
        assert_eq!(listed["personRequired"], true);
        assert_eq!(listed["botId"], "bot-1");
        assert_eq!(listed["connectionId"], "asker");
        assert!(approvals.waiting.is_waiting());
        assert!(!out.exists());
        client
            .respond_permission(listed["requestId"].as_str().unwrap(), Some("allow".into()))
            .unwrap();
        assert_eq!(told(&out).await["outcome"]["optionId"], "allow");
        assert!(client.waiting_requests().is_empty());
        assert!(!approvals.waiting.is_waiting());
        assert!(!approvals.blocked.load(Ordering::Relaxed));
        client.kill().await;
        let _ = std::fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn a_person_declining_an_unattended_request_blocks_the_run() {
        let dir = std::env::temp_dir().join(format!("codexia-acp-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let out = dir.join("told.json");
        let approvals = UnattendedApprovals::default();
        let client = asking_fixture(approvals.clone(), Value::Null, &out).await;
        let listed = first_waiting(&client).await;
        assert_eq!(listed["personRequired"], false);
        client
            .respond_permission(listed["requestId"].as_str().unwrap(), Some("deny".into()))
            .unwrap();
        assert_eq!(told(&out).await["outcome"]["optionId"], "deny");
        assert!(approvals.blocked.load(Ordering::Relaxed));
        client.kill().await;
        let _ = std::fs::remove_dir_all(dir);
    }
}
