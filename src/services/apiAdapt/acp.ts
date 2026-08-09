import { dual, dualGet, dualVoid } from './shared';

export type AcpAgentDef = {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  available: boolean;
};

export type AcpAuthMethod = {
  id: string;
  name: string;
  description?: string | null;
};

export type AcpInitializeResult = {
  protocolVersion?: number;
  agentInfo?: { name?: string; title?: string; version?: string };
  authMethods?: AcpAuthMethod[];
  agentCapabilities?: Record<string, unknown>;
};

/** `modes` on the `session/new` result — the older, mode-only mechanism. */
export type AcpModeState = {
  currentModeId: string;
  availableModes: Array<{ id: string; name: string; description?: string }>;
};

/** A reasoning-effort level, advertised per model under `_meta` (Grok). */
export type AcpReasoningEffort = {
  id: string;
  label?: string;
  description?: string;
  default?: boolean;
};

export type AcpModel = {
  modelId: string;
  name: string;
  description?: string;
  _meta?: { reasoningEfforts?: AcpReasoningEffort[] };
};

/** `models` on the `session/new` result. */
export type AcpModelState = {
  currentModelId: string;
  availableModels: AcpModel[];
};

/**
 * `configOptions` — the generic mechanism that supersedes `modes`/`models`.
 * Agents expose mode, model and reasoning effort through it uniformly.
 */
export type AcpConfigOption = {
  id: string;
  name: string;
  description?: string;
  category?: 'mode' | 'model' | 'model_config' | 'thought_level' | string;
  type: 'select' | 'boolean';
  currentValue: string | boolean;
  options?: Array<{ value: string; name: string; description?: string }>;
};

export type AcpSessionResult = {
  sessionId: string;
  modes?: AcpModeState;
  models?: AcpModelState;
  configOptions?: AcpConfigOption[];
};

export type AcpStartResult = {
  connectionId: string;
  sessionId: string | null;
  initialize: AcpInitializeResult;
  session: AcpSessionResult | null;
  sessionError: string | null;
};

export async function acpListAgents() {
  return await dualGet<AcpAgentDef[]>('acp_list_agents', undefined, '/api/acp/agents');
}

export async function acpStart(agentId: string, cwd: string, custom?: AcpAgentDef) {
  return await dual<AcpStartResult>(
    'acp_start',
    { agentId, cwd, custom: custom ?? null },
    '/api/acp/start',
    { agent_id: agentId, cwd, custom: custom ?? null }
  );
}

export async function acpPrompt(connectionId: string, text: string) {
  return await dual<{ stopReason?: string }>(
    'acp_prompt',
    { connectionId, text },
    '/api/acp/prompt',
    { connection_id: connectionId, text }
  );
}

export async function acpCancel(connectionId: string) {
  await dualVoid('acp_cancel', { connectionId }, '/api/acp/cancel', {
    connection_id: connectionId,
  });
}

export async function acpAuthenticate(connectionId: string, methodId: string) {
  await dualVoid('acp_authenticate', { connectionId, methodId }, '/api/acp/authenticate', {
    connection_id: connectionId,
    method_id: methodId,
  });
}

export async function acpNewSession(connectionId: string, cwd: string) {
  return await dual<AcpSessionResult>(
    'acp_new_session',
    { connectionId, cwd },
    '/api/acp/new-session',
    { connection_id: connectionId, cwd }
  );
}

export async function acpSetMode(connectionId: string, modeId: string) {
  await dual('acp_set_mode', { connectionId, modeId }, '/api/acp/set-mode', {
    connection_id: connectionId,
    mode_id: modeId,
  });
}

export async function acpSetModel(
  connectionId: string,
  modelId: string,
  reasoningEffort?: string | null
) {
  await dual(
    'acp_set_model',
    { connectionId, modelId, reasoningEffort: reasoningEffort ?? null },
    '/api/acp/set-model',
    { connection_id: connectionId, model_id: modelId, reasoning_effort: reasoningEffort ?? null }
  );
}

export async function acpSetConfigOption(
  connectionId: string,
  configId: string,
  value: string | boolean
) {
  await dual(
    'acp_set_config_option',
    { connectionId, configId, value },
    '/api/acp/set-config-option',
    { connection_id: connectionId, config_id: configId, value }
  );
}

export async function acpRespondPermission(
  connectionId: string,
  requestId: string,
  optionId: string | null
) {
  await dualVoid(
    'acp_respond_permission',
    { connectionId, requestId, optionId },
    '/api/acp/respond-permission',
    { connection_id: connectionId, request_id: requestId, option_id: optionId }
  );
}

export async function acpStop(connectionId: string) {
  await dualVoid('acp_stop', { connectionId }, '/api/acp/stop', { connection_id: connectionId });
}
