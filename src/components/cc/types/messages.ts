export type AssistantMessageError =
  | 'authentication_failed'
  | 'billing_error'
  | 'rate_limit'
  | 'invalid_request'
  | 'server_error'
  | 'unknown';

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export type ToolResultContent = string | Array<Record<string, unknown>>;

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content?: ToolResultContent;
  is_error?: boolean;
}

export type ImageSource =
  | { type: 'base64'; media_type: string; data: string }
  | { type: 'url'; url: string };

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | ToolUseBlock
  | ToolResultBlock
  | { type: 'image'; source: ImageSource };

/** User message */
export interface UserMessage {
  type: 'user';
  text?: string;
  content?: ContentBlock[];
  uuid?: string;
  session_id?: string;
  parent_tool_use_id?: string;
}

/** Inner assistant message content */
export interface AssistantMessageInner {
  content: ContentBlock[];
  model?: string;
  id?: string;
  stop_reason?: string;
  usage?: Record<string, any>;
  error?: AssistantMessageError;
}

/** Assistant message */
export interface AssistantMessage {
  type: 'assistant';
  message: AssistantMessageInner;
  parent_tool_use_id?: string;
  session_id?: string;
  uuid?: string;
}

/** System message */
export interface SystemMessage {
  type: 'system';
  subtype: string;
  cwd?: string;
  session_id?: string;
  tools?: string[];
  mcp_servers?: Array<Record<string, unknown>>;
  model?: string;
  permissionMode?: string;
  uuid?: string;
  /** Slash commands available in this session (from System::init) */
  slash_commands?: string[];
}

/** Result message indicating query completion */
export interface ResultMessage {
  type: 'result';
  subtype: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  session_id: string;
  total_cost_usd?: number;
  usage?: Record<string, any>;
  result?: string;
  structured_output?: Record<string, any>;
}

/** Stream event message */
export interface StreamEvent {
  type: 'stream_event';
  uuid: string;
  session_id: string;
  event: Record<string, any>;
  parent_tool_use_id?: string;
}

/** Permission request message - specific to interactive mode */
export interface PermissionRequestMessage {
  type: 'permission_request';
  requestId: string;
  sessionId: string;
  toolName: string;
  toolInput: Record<string, any>;
  /** Whether "always allow" targets project settings or session memory (only one shown) */
  alwaysAllowTarget?: 'project' | 'session';
  resolved?: 'allow' | 'allow_always' | 'allow_project' | 'deny';
}

/** Control cancel request (internal protocol) */
export interface ControlCancelRequest {
  type: 'control_cancel_request';
  [key: string]: any;
}

/** Rate limit event */
export interface RateLimitInfo {
  isUsingOverage: boolean;
  overageDisabledReason?: string;
  overageStatus?: string;
  rateLimitType?: string;
  resetsAt?: number;
  status?: string;
}

export interface RateLimitEvent {
  type: 'rate_limit_event';
  uuid: string;
  session_id: string;
  rate_limit_info: RateLimitInfo;
}

/** Main message union type */
export type CCMessage =
  | AssistantMessage
  | SystemMessage
  | ResultMessage
  | StreamEvent
  | UserMessage
  | PermissionRequestMessage
  | ControlCancelRequest
  | RateLimitEvent;

export function isToolResultBlock(block: ContentBlock): block is ToolResultBlock {
  return block.type === 'tool_result';
}
