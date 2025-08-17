export interface CodexEvent {
  id: string;
  msg: EventMsg;
  // Optional backend timing metadata (ms since epoch)
  t_read_ms?: number;
  t_emit_ms?: number;
}

export type EventMsg = 
  | { type: 'session_configured'; session_id: string; model: string; history_log_id?: number; history_entry_count?: number }
  | { type: 'task_started' }
  | { type: 'task_complete'; response_id?: string; last_agent_message?: string }
  | { type: 'agent_message'; message?: string; last_agent_message?: string }
  | { type: 'agent_message_delta'; delta: string }
  | { type: 'agent_reasoning_delta'; delta: string }
  | { type: 'agent_reasoning'; text: string }
  | { type: 'exec_approval_request'; command: string; cwd: string }
  | { type: 'patch_approval_request'; patch: string; files: string[] }
  | { type: 'error'; message: string }
  | { type: 'turn_complete'; response_id?: string }
  | { type: 'exec_command_begin'; call_id: string; command: string[]; cwd: string }
  | { type: 'exec_command_output_delta'; call_id: string; stream: string; chunk: number[] }
  | { type: 'exec_command_end'; call_id: string; stdout: string; stderr: string; exit_code: number }
  | { type: 'token_count'; input_tokens: number; cached_input_tokens: number; output_tokens: number; reasoning_output_tokens: number; total_tokens: number }
  | { type: 'shutdown_complete' }
  | { type: 'background_event'; message: string };

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  reasoning?: string;
  isReasoningStreaming?: boolean;
  toolOutput?: string;
  isToolStreaming?: boolean;
}

export interface ApprovalRequest {
  id: string;
  type: 'exec' | 'patch';
  command?: string;
  cwd?: string;
  patch?: string;
  files?: string[];
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  isActive: boolean;
  pendingApproval?: ApprovalRequest;
  config: CodexConfig;
  isLoading?: boolean;
}

export interface CodexConfig {
  workingDirectory: string;
  model: string;
  provider: 'openai' | 'oss' | 'custom';
  useOss: boolean;
  customArgs?: string[];
  approvalPolicy: 'untrusted' | 'on-failure' | 'on-request' | 'never';
  sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access';
  codexPath?: string;
}

export const DEFAULT_CONFIG: CodexConfig = {
  workingDirectory: '',
  model: 'gpt-oss:20b',
  provider: 'oss',
  useOss: true,
  approvalPolicy: 'on-request',
  sandboxMode: 'workspace-write',
};

export type McpServerConfig = 
  | {
      type: 'stdio';
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  | {
      type: 'http';
      url: string;
    };
