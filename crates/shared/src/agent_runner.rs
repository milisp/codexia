use async_trait::async_trait;
use std::sync::Arc;

/// Reports the agent-side run key (codex thread id / cc session id) as soon as it
/// exists, so the caller can record the run before it finishes.
pub type RunStartedHook = Arc<dyn Fn(&str) + Send + Sync>;

/// One agent invocation for one working directory.
pub struct AgentRunSpec {
    pub task_id: String,
    pub task_name: String,
    pub prompt: String,
    pub model: String,
    pub model_provider: String,
    pub cwd: Option<String>,
    pub on_started: RunStartedHook,
}

/// Whether the final status is known once `start_run` returns.
pub enum AgentRunOutcome {
    /// The agent finished the work; the caller may mark the run completed.
    Finished,
    /// The work was only handed off; completion arrives out of band.
    Detached,
}

/// An agent that automation can drive. Implementations live in the agent crates:
/// - `CodexAgentRunner` in `codexia-codex`
/// - `CcAgentRunner` in `codexia-cc`
#[async_trait]
pub trait AgentRunner: Send + Sync {
    /// Identifier stored on the task (e.g. "codex", "cc").
    fn agent(&self) -> &'static str;

    async fn start_run(&self, spec: AgentRunSpec) -> Result<AgentRunOutcome, String>;
}
