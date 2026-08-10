use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use claude_agent_sdk_rs::{ClaudeAgentOptions, EffortLevel, PermissionMode};
use claude_agent_sdk_rs::types::mcp::{
    McpHttpServerConfig, McpServerConfig, McpServers, McpSseServerConfig, McpStdioServerConfig,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CCConnectParams {
    pub session_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub permission_mode: Option<String>,
    pub resume_id: Option<String>,
}

/// MCP server configuration for serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum McpServerConfigSerde {
    Stdio {
        command: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        args: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<HashMap<String, String>>,
    },
    Http {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
    },
    Sse {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
    },
}


/// Serializable options for ClaudeAgent
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentOptions {
    pub cwd: String,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub permission_mode: Option<String>,
    pub fallback_model: Option<String>,
    pub max_turns: Option<u32>,
    pub max_budget_usd: Option<f64>,
    pub max_thinking_tokens: Option<u32>,
    pub settings: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub disallowed_tools: Option<Vec<String>>,
    pub mcp_servers: Option<HashMap<String, McpServerConfigSerde>>,
    pub resume: Option<String>,
    pub continue_conversation: Option<bool>,
}

pub(crate) fn parse_effort_level(effort: &str) -> Option<EffortLevel> {
    match effort {
        "low" => Some(EffortLevel::Low),
        "medium" => Some(EffortLevel::Medium),
        "high" => Some(EffortLevel::High),
        "xhigh" => Some(EffortLevel::XHigh),
        "max" => Some(EffortLevel::Max),
        other => {
            log::warn!("[CC] unknown effort level {:?}, falling back to CLI default", other);
            None
        }
    }
}

pub(crate) fn parse_permission_mode(mode: &str) -> Option<PermissionMode> {
    match mode {
        "default" => Some(PermissionMode::Default),
        "acceptEdits" => Some(PermissionMode::AcceptEdits),
        "plan" => Some(PermissionMode::Plan),
        "bypassPermissions" => Some(PermissionMode::BypassPermissions),
        "auto" => Some(PermissionMode::Auto),
        "dontAsk" => Some(PermissionMode::DontAsk),
        "manual" => Some(PermissionMode::Manual),
        other => {
            log::warn!("[CC] unknown permission mode {:?}, falling back to CLI default", other);
            None
        }
    }
}

impl From<McpServerConfigSerde> for McpServerConfig {
    fn from(cfg: McpServerConfigSerde) -> Self {
        match cfg {
            McpServerConfigSerde::Stdio { command, args, env } => {
                McpServerConfig::Stdio(McpStdioServerConfig { command, args, env })
            }
            McpServerConfigSerde::Http { url, headers } => {
                McpServerConfig::Http(McpHttpServerConfig { url, headers })
            }
            McpServerConfigSerde::Sse { url, headers } => {
                McpServerConfig::Sse(McpSseServerConfig { url, headers })
            }
        }
    }
}

impl AgentOptions {
    pub fn to_claude_options(&self, resume_id: Option<String>) -> ClaudeAgentOptions {
        let permission_mode = self.permission_mode.as_deref().and_then(parse_permission_mode);

        let mcp_servers = if let Some(servers) = &self.mcp_servers {
            let map: HashMap<String, McpServerConfig> = servers
                .iter()
                .map(|(name, cfg)| (name.clone(), McpServerConfig::from(cfg.clone())))
                .collect();
            McpServers::Dict(map)
        } else {
            McpServers::Empty
        };

        ClaudeAgentOptions {
            cwd: Some(PathBuf::from(&self.cwd)),
            model: self.model.clone(),
            effort: self.effort.as_deref().and_then(parse_effort_level),
            fallback_model: self.fallback_model.clone(),
            max_turns: self.max_turns,
            max_budget_usd: self.max_budget_usd,
            max_thinking_tokens: self.max_thinking_tokens,
            settings: self.settings.clone(),
            permission_mode,
            allowed_tools: self.allowed_tools.clone().unwrap_or_default(),
            disallowed_tools: self.disallowed_tools.clone().unwrap_or_default(),
            mcp_servers,
            resume: resume_id.or_else(|| self.resume.clone()),
            continue_conversation: self.continue_conversation.unwrap_or(false),
            stderr_callback: Some(Arc::new(|msg| log::error!("[CC STDERR] {}", msg))),
            ..Default::default()
        }
    }
}
