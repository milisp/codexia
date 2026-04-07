use codex_app_server_protocol::{
    CommandExecutionApprovalDecision, FileChangeApprovalDecision, RequestId, ThreadListParams,
    ToolRequestUserInputResponse,
};
use serde::Deserialize;
use serde_json::Value;

use crate::cc::mcp::ClaudeCodeMcpServer;
use crate::cc::types::AgentOptions;
use crate::features::automation::AutomationSchedule;

#[derive(Deserialize)]
pub(crate) struct ListThreadsRequest {
    #[serde(flatten)]
    pub(crate) params: ThreadListParams,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct CommandExecutionApprovalParams {
    pub(crate) request_id: RequestId,
    pub(crate) decision: CommandExecutionApprovalDecision,
}

#[derive(Deserialize)]
pub(crate) struct FileChangeApprovalParams {
    pub(crate) request_id: RequestId,
    pub(crate) decision: FileChangeApprovalDecision,
}

#[derive(Deserialize)]
pub(crate) struct UserInputResponseParams {
    pub(crate) request_id: RequestId,
    pub(crate) response: ToolRequestUserInputResponse,
}

#[derive(Deserialize)]
pub(crate) struct NotesListParams {
    #[serde(default, alias = "userId")]
    pub(crate) user_id: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct CreateNoteParams {
    pub(crate) id: String,
    #[serde(default, alias = "userId")]
    pub(crate) user_id: Option<String>,
    pub(crate) title: String,
    pub(crate) content: String,
    #[serde(default)]
    pub(crate) tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub(crate) struct GetNoteByIdParams {
    pub(crate) id: String,
}

#[derive(Deserialize)]
pub(crate) struct UpdateNoteParams {
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) title: Option<String>,
    #[serde(default)]
    pub(crate) content: Option<String>,
    #[serde(default)]
    pub(crate) tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub(crate) struct DeleteNoteParams {
    pub(crate) id: String,
}

#[derive(Deserialize)]
pub(crate) struct ToggleFavoriteParams {
    pub(crate) id: String,
}

#[derive(Deserialize)]
pub(crate) struct NotesMarkSyncedParams {
    pub(crate) ids: Vec<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillsMarketplaceParams {
    pub(crate) selected_agent: String,
    pub(crate) scope: String,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillsInstallParams {
    pub(crate) skill_md_path: String,
    pub(crate) skill_name: String,
    pub(crate) selected_agent: String,
    pub(crate) scope: String,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillsUninstallParams {
    pub(crate) skill_name: String,
    pub(crate) selected_agent: String,
    pub(crate) scope: String,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillsCloneRepoParams {
    pub(crate) url: String,
}

#[derive(Deserialize)]
pub(crate) struct SkillGroupsScopeParams {
    pub(crate) scope: String,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillsLinkToAgentParams {
    pub(crate) skill_name: String,
    pub(crate) agent: String,
    pub(crate) scope: String,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillsDeleteCentralParams {
    pub(crate) skill_name: String,
    pub(crate) scope: String,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillsshLeaderboardParams {
    pub(crate) board: String,
}

#[derive(Deserialize)]
pub(crate) struct SkillsshSearchParams {
    pub(crate) query: String,
    pub(crate) limit: u32,
}

#[derive(Deserialize)]
pub(crate) struct SkillsshInstallParams {
    pub(crate) source: String,
    pub(crate) skill_id: String,
    pub(crate) scope: String,
    pub(crate) cwd: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SkillGroupsWriteParams {
    pub(crate) config: crate::features::skills::SkillGroupsConfig,
}

#[derive(Deserialize)]
pub(crate) struct UnifiedMcpAddParams {
    #[serde(rename = "client_name", alias = "clientName")]
    pub(crate) client_name: String,
    pub(crate) path: Option<String>,
    #[serde(rename = "server_name", alias = "serverName")]
    pub(crate) server_name: String,
    #[serde(rename = "server_config", alias = "serverConfig")]
    pub(crate) server_config: Value,
    pub(crate) scope: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct UnifiedMcpRemoveParams {
    #[serde(rename = "client_name", alias = "clientName")]
    pub(crate) client_name: String,
    pub(crate) path: Option<String>,
    #[serde(rename = "server_name", alias = "serverName")]
    pub(crate) server_name: String,
    pub(crate) scope: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct UnifiedMcpToggleParams {
    #[serde(rename = "client_name", alias = "clientName")]
    pub(crate) client_name: String,
    pub(crate) path: Option<String>,
    #[serde(rename = "server_name", alias = "serverName")]
    pub(crate) server_name: String,
}

#[derive(Deserialize)]
pub(crate) struct UnifiedMcpReadParams {
    #[serde(rename = "client_name", alias = "clientName")]
    pub(crate) client_name: String,
    pub(crate) path: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct CcSessionIdParams {
    #[serde(rename = "session_id", alias = "sessionId")]
    pub(crate) session_id: String,
}

#[derive(Deserialize)]
pub(crate) struct CcGetSessionsParams {
    #[serde(default)]
    pub(crate) directory: Option<String>,
    #[serde(default)]
    pub(crate) limit: Option<usize>,
    #[serde(default)]
    pub(crate) offset: Option<usize>,
    #[serde(default, rename = "include_worktrees", alias = "includeWorktrees")]
    pub(crate) include_worktrees: Option<bool>,
}

#[derive(Deserialize)]
pub(crate) struct CcSendMessageParams {
    #[serde(rename = "session_id", alias = "sessionId")]
    pub(crate) session_id: String,
    pub(crate) message: String,
    #[serde(default)]
    pub(crate) image_paths: Vec<String>,
}

#[derive(Deserialize)]
pub(crate) struct CcNewSessionParams {
    pub(crate) options: AgentOptions,
}

#[derive(Deserialize)]
pub(crate) struct CcResumeSessionParams {
    #[serde(rename = "session_id", alias = "sessionId")]
    pub(crate) session_id: String,
    pub(crate) options: AgentOptions,
}

#[derive(Deserialize)]
pub(crate) struct CcUpdateSettingsParams {
    pub(crate) settings: Value,
}

#[derive(Deserialize)]
pub(crate) struct CcResolvePermissionParams {
    #[serde(rename = "request_id", alias = "requestId")]
    pub(crate) request_id: String,
    pub(crate) decision: String,
}

#[derive(Deserialize)]
pub(crate) struct CcSetPermissionModeParams {
    #[serde(rename = "session_id", alias = "sessionId")]
    pub(crate) session_id: String,
    pub(crate) mode: String,
}

#[derive(Deserialize)]
pub(crate) struct CcMcpListParams {
    #[serde(rename = "working_dir", alias = "workingDir")]
    pub(crate) working_dir: String,
}

#[derive(Deserialize)]
pub(crate) struct CcMcpGetParams {
    pub(crate) name: String,
    #[serde(rename = "working_dir", alias = "workingDir")]
    pub(crate) working_dir: String,
}

#[derive(Deserialize)]
pub(crate) struct CcMcpAddParams {
    pub(crate) request: ClaudeCodeMcpServer,
    #[serde(rename = "working_dir", alias = "workingDir")]
    pub(crate) working_dir: String,
}

#[derive(Deserialize)]
pub(crate) struct CcMcpRemoveParams {
    pub(crate) name: String,
    #[serde(rename = "working_dir", alias = "workingDir")]
    pub(crate) working_dir: String,
    pub(crate) scope: String,
}

#[derive(Deserialize)]
pub(crate) struct CcMcpToggleParams {
    pub(crate) name: String,
    #[serde(rename = "working_dir", alias = "workingDir")]
    pub(crate) working_dir: String,
}

#[derive(Deserialize)]
pub(crate) struct SleepParams {
    #[serde(default, rename = "conversation_id", alias = "conversationId")]
    pub(crate) conversation_id: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct CreateAutomationParams {
  pub(crate) name: String,
  #[serde(default)]
  pub(crate) projects: Vec<String>,
  pub(crate) prompt: String,
  pub(crate) schedule: AutomationSchedule,
  #[serde(default)]
  pub(crate) agent: Option<String>,
  #[serde(default)]
  #[serde(rename = "model_provider", alias = "modelProvider")]
  pub(crate) model_provider: Option<String>,
  #[serde(default)]
  pub(crate) model: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct ListAutomationRunsParams {
    #[serde(default, rename = "task_id", alias = "taskId")]
    pub(crate) task_id: Option<String>,
    #[serde(default)]
    pub(crate) limit: Option<u32>,
}

#[derive(Deserialize)]
pub(crate) struct UpdateAutomationParams {
    pub(crate) id: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) projects: Vec<String>,
    pub(crate) prompt: String,
    pub(crate) schedule: AutomationSchedule,
    #[serde(default)]
    pub(crate) agent: Option<String>,
    #[serde(default)]
    #[serde(rename = "model_provider", alias = "modelProvider")]
    pub(crate) model_provider: Option<String>,
    #[serde(default)]
    pub(crate) model: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct SetAutomationPausedParams {
    pub(crate) id: String,
    pub(crate) paused: bool,
}

#[derive(Deserialize)]
pub(crate) struct DeleteAutomationParams {
    pub(crate) id: String,
}

#[derive(Deserialize)]
pub(crate) struct RunAutomationNowParams {
    pub(crate) id: String,
}

#[derive(Deserialize)]
pub(crate) struct InsightFiltersParams {
    #[serde(default)]
    pub(crate) range: Option<String>,
    #[serde(default)]
    pub(crate) cwd: Option<String>,
    #[serde(default, rename = "session_id", alias = "sessionId")]
    pub(crate) session_id: Option<String>,
    #[serde(default)]
    pub(crate) agent: Option<String>,
}
