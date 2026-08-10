import type { CCMcpServers } from '@/types/cc/cc-mcp';

/**
 * Payload sent to `cc_new_session` / `cc_resume_session`.
 * Mirrors `AgentOptions` in crates/cc/src/types.rs (serde camelCase).
 */
export interface CcAgentOptionsPayload {
  /** Required: the Rust side deserializes this as a non-optional String. */
  cwd: string;
  model?: string;
  effort?: string;
  permissionMode?: string;
  fallbackModel?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  maxThinkingTokens?: number;
  settings?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  mcpServers?: CCMcpServers;
  resume?: string;
  continueConversation?: boolean;
}
