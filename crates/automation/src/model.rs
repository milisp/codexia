use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutomationScheduleMode {
    Daily,
    Interval,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationSchedule {
    pub mode: AutomationScheduleMode,
    #[serde(default)]
    pub hour: Option<u8>,
    #[serde(default)]
    pub minute: Option<u8>,
    #[serde(default)]
    pub interval_hours: Option<u8>,
    #[serde(default)]
    pub weekdays: Vec<String>,
}

/// Where a run does its work.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CwdMode {
    /// Run directly in the project directory. The default so that tasks created
    /// before this option existed keep their current behaviour.
    #[default]
    Cwd,
    /// Run in a per-task linked git worktree, leaving the project untouched.
    Worktree,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationTask {
    pub id: String,
    pub name: String,
    pub projects: Vec<String>,
    pub prompt: String,
    #[serde(default = "default_agent", alias = "access_mode")]
    pub agent: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_model_provider")]
    pub model_provider: String,
    pub schedule: AutomationSchedule,
    pub cron_expression: String,
    pub created_at: String,
    #[serde(default)]
    pub paused: bool,
    #[serde(default)]
    pub cwd_mode: CwdMode,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub(super) struct AutomationStore {
    pub(super) tasks: Vec<AutomationTask>,
}

pub(super) fn default_agent() -> String {
    "codex".to_string()
}

pub(super) fn default_model() -> String {
    "gpt-5-codex".to_string()
}

pub(super) fn default_model_provider() -> String {
    "openai".to_string()
}

/// Accepts any agent that has a registered runner, so adding an agent needs no
/// change here.
pub(super) fn normalize_agent(
    value: Option<String>,
    known_agents: &[String],
) -> Result<String, String> {
    let normalized = value
        .unwrap_or_else(default_agent)
        .trim()
        .to_ascii_lowercase();
    // Legacy alias kept for tasks stored before agents were named.
    let normalized = if normalized == "agent" {
        default_agent()
    } else {
        normalized
    };

    if known_agents.contains(&normalized) {
        return Ok(normalized);
    }
    Err(format!(
        "unknown agent '{}', expected one of: {}",
        normalized,
        known_agents.join(", ")
    ))
}

/// Trim the value and fall back to `default` when it is missing or empty.
pub(super) fn or_default(value: Option<String>, default: fn() -> String) -> String {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(default)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn known() -> Vec<String> {
        vec!["codex".to_string(), "cc".to_string()]
    }

    #[test]
    fn normalize_agent_defaults_and_trims() {
        assert_eq!(normalize_agent(None, &known()).unwrap(), "codex");
        assert_eq!(normalize_agent(Some(" CC ".to_string()), &known()).unwrap(), "cc");
    }

    #[test]
    fn normalize_agent_maps_legacy_alias() {
        assert_eq!(normalize_agent(Some("agent".to_string()), &known()).unwrap(), "codex");
    }

    #[test]
    fn normalize_agent_rejects_unregistered_agent() {
        let err = normalize_agent(Some("gemini".to_string()), &known()).expect_err("unknown agent");
        assert!(err.contains("unknown agent 'gemini'"));
    }

    #[test]
    fn or_default_falls_back_on_blank() {
        assert_eq!(or_default(None, default_model), default_model());
        assert_eq!(or_default(Some("  ".to_string()), default_model), default_model());
        assert_eq!(or_default(Some(" gpt-x ".to_string()), default_model), "gpt-x");
    }
}
