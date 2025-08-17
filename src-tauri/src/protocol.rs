use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Submission {
    pub id: String,
    pub op: Op,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Op {
    ConfigureSession {
        provider: ModelProvider,
        model: String,
        model_reasoning_effort: String,
        model_reasoning_summary: String,
        user_instructions: Option<String>,
        base_instructions: Option<String>,
        approval_policy: String,
        sandbox_policy: SandboxPolicy,
        disable_response_storage: bool,
        cwd: PathBuf,
        resume_path: Option<PathBuf>,
    },
    UserInput {
        items: Vec<InputItem>,
    },
    Interrupt,
    ExecApproval {
        id: String,
        decision: String,
    },
    PatchApproval {
        id: String,
        decision: String,
    },
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProvider {
    pub name: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "kebab-case")]
pub enum SandboxPolicy {
    #[serde(rename = "read-only")]
    ReadOnly,
    #[serde(rename = "workspace-write")]
    WorkspaceWrite {
        #[serde(default)]
        writable_roots: Vec<PathBuf>,
        #[serde(default)]
        network_access: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InputItem {
    Text { text: String },
    Image { image_url: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub msg: EventMsg,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EventMsg {
    SessionConfigured {
        session_id: String,
        model: String,
        history_log_id: Option<u32>,
        history_entry_count: Option<u32>,
    },
    TaskStarted,
    TaskComplete {
        response_id: Option<String>,
        last_agent_message: Option<String>,
    },
    AgentMessage {
        message: Option<String>,
        last_agent_message: Option<String>,
    },
    AgentMessageDelta {
        delta: String,
    },
    AgentReasoning {
        text: String,
    },
    AgentReasoningDelta {
        delta: String,
    },
    ExecApprovalRequest {
        command: String,
        cwd: String,
    },
    PatchApprovalRequest {
        patch: String,
        files: Vec<String>,
    },
    Error {
        message: String,
    },
    TurnComplete {
        response_id: Option<String>,
    },
    ExecCommandBegin {
        call_id: String,
        command: Vec<String>,
        cwd: String,
    },
    ExecCommandOutputDelta {
        call_id: String,
        stream: String,
        chunk: Vec<u8>,
    },
    ExecCommandEnd {
        call_id: String,
        stdout: String,
        stderr: String,
        exit_code: i32,
    },
    ShutdownComplete,
    BackgroundEvent {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexConfig {
    pub working_directory: String,
    pub model: String,
    pub provider: String,
    pub use_oss: bool,
    pub custom_args: Option<Vec<String>>,
    pub approval_policy: String,
    pub sandbox_mode: String,
    pub codex_path: Option<String>,
}
