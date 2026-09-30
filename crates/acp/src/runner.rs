//! Runs a bot's routine on behalf of `codexia-automation`.

use async_trait::async_trait;

use codexia_shared::agent_runner::{AgentRunOutcome, AgentRunSpec, AgentRunner};

use crate::AcpState;

pub struct BotAgentRunner {
    state: AcpState,
}

impl BotAgentRunner {
    pub fn new(state: AcpState) -> Self {
        Self { state }
    }
}

#[async_trait]
impl AgentRunner for BotAgentRunner {
    fn agent(&self) -> &'static str {
        "bot"
    }

    async fn start_run(&self, spec: AgentRunSpec) -> Result<AgentRunOutcome, String> {
        let bot_id = spec
            .bot_id
            .as_deref()
            .ok_or("a bot routine needs a bot")?;
        let on_started = spec.on_started.clone();
        let report = self
            .state
            .run_bot_unattended(bot_id, &spec.prompt, spec.cwd.as_deref(), true, |session_id| {
                on_started(session_id)
            })
            .await?;
        if report.blocked {
            // The run itself finished, but part of the job was refused: say so
            // in the run's status rather than report a clean success.
            return Err("blocked: a step needed approval the bot does not have".to_string());
        }
        Ok(AgentRunOutcome::Finished)
    }
}
