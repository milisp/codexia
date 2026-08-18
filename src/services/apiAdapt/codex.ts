import type { RequestId, ThreadId } from '@/bindings';
import type {
  CommandExecutionApprovalDecision,
  FileChangeApprovalDecision,
  GetAccountParams,
  GetAccountRateLimitsResponse,
  GetAccountResponse,
  LoginAccountParams,
  LoginAccountResponse,
  ModelListParams,
  ModelListResponse,
  PluginInstallParams,
  PluginInstallResponse,
  PluginListParams,
  PluginListResponse,
  PluginReadParams,
  PluginReadResponse,
  PluginUninstallParams,
  PluginUninstallResponse,
  ReviewStartParams,
  ReviewStartResponse,
  ThreadForkParams,
  ThreadForkResponse,
  ThreadGoalClearParams,
  ThreadGoalClearResponse,
  ThreadGoalGetParams,
  ThreadGoalGetResponse,
  ThreadGoalSetParams,
  ThreadGoalSetResponse,
  ThreadListParams,
  ThreadListResponse,
  ThreadResumeParams,
  ThreadResumeResponse,
  ThreadRollbackParams,
  ThreadRollbackResponse,
  ThreadStartParams,
  ThreadStartResponse,
  TurnInterruptParams,
  TurnStartParams,
  TurnStartResponse,
  TurnSteerParams,
  TurnSteerResponse,
} from '@/bindings/v2';
import type {
  ConfigProvider,
  EnvStatusItem,
  FrontendProviderModels,
  ProviderPreset,
} from '@/components/codex/types';
import { dual, dualGet, dualVoid, invokeTauri, isDesktopTauri, toast } from './shared';

export * from './mcp';
export * from './skills';

export async function initializeCodexAsync() {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('initialize_codex_async');
  }
}

export async function listModels() {
  const params: ModelListParams = {
    cursor: null,
    limit: 100,
  };
  return await dual<ModelListResponse>('model_list', { params }, '/api/codex/model/list', params);
}

export async function threadStart(params: ThreadStartParams) {
  return await dual<ThreadStartResponse>(
    'start_thread',
    { params },
    '/api/codex/thread/start',
    params
  );
}

export async function threadResume(params: ThreadResumeParams) {
  return await dual<ThreadResumeResponse>(
    'resume_thread',
    { params },
    '/api/codex/thread/resume',
    params
  );
}

export async function threadFork(params: ThreadForkParams) {
  return await dual<ThreadForkResponse>(
    'fork_thread',
    { params },
    '/api/codex/thread/fork',
    params
  );
}

export async function threadRollback(params: ThreadRollbackParams) {
  return await dual<ThreadRollbackResponse>(
    'rollback_thread',
    { params },
    '/api/codex/thread/rollback',
    params
  );
}

export async function turnStart(params: TurnStartParams) {
  return await dual<TurnStartResponse>('turn_start', { params }, '/api/codex/turn/start', params);
}

export async function turnSteer(params: TurnSteerParams) {
  return await dual<TurnSteerResponse>('turn_steer', { params }, '/api/codex/turn/steer', params);
}

export async function turnInterrupt(params: TurnInterruptParams) {
  return await dual('turn_interrupt', { params }, '/api/codex/turn/interrupt', params);
}

export async function listThreads(params: ThreadListParams) {
  return await dual<ThreadListResponse>('list_threads', { params }, '/api/codex/thread/list', {
    ...params,
  });
}

export async function archiveThread(threadId: ThreadId) {
  return await dual('archive_thread', { threadId }, '/api/codex/thread/archive', { threadId });
}

export async function unarchiveThread(threadId: ThreadId) {
  return await dual('unarchive_thread', { threadId }, '/api/codex/thread/unarchive', { threadId });
}

export async function deleteThread(threadId: ThreadId) {
  return await dual('delete_thread', { threadId }, '/api/codex/thread/delete', { threadId });
}

export async function renameThread(threadId: ThreadId, name: string) {
  const params = { threadId, name };
  return await dual('rename_thread', { params }, '/api/codex/thread/rename', { params });
}

export async function loginChatGpt() {
  if (isDesktopTauri()) {
    return await invokeTauri<LoginAccountResponse>('login_chatgpt');
  }
  toast({
    title: 'loginChatGpt is only available in Tauri mode.',
    variant: 'destructive',
  });
  return Promise.reject(new Error('loginChatGpt is only available in Tauri mode.'));
}

export async function getAccount() {
  return await getAccountWithParams({ refreshToken: false });
}

export async function getAccountWithParams(params: GetAccountParams) {
  return await dual<GetAccountResponse>(
    'get_account',
    { params },
    '/api/codex/account/get',
    params
  );
}

export async function loginAccount(params: LoginAccountParams) {
  return await dual<LoginAccountResponse>(
    'login_account',
    { params },
    '/api/codex/account/login',
    params
  );
}

export async function startReview(params: ReviewStartParams) {
  return await dual<ReviewStartResponse>(
    'start_review',
    { params },
    '/api/codex/review/start',
    params
  );
}

export async function getAccountRateLimits() {
  return await dualGet<GetAccountRateLimitsResponse>(
    'account_rate_limits',
    undefined,
    '/api/codex/account/rate-limits'
  );
}

export async function respondToRequestUserInput(requestId: RequestId, response: unknown) {
  return await dualVoid(
    'respond_to_request_user_input',
    { requestId, response },
    '/api/codex/approval/user-input',
    { request_id: requestId, response }
  );
}

export async function respondToCommandExecutionApproval(
  requestId: RequestId,
  decision: CommandExecutionApprovalDecision
) {
  return await dualVoid(
    'respond_to_command_execution_approval',
    { requestId, decision },
    '/api/codex/approval/command-execution',
    { request_id: requestId, decision }
  );
}

export async function respondToFileChangeApproval(
  requestId: RequestId,
  decision: FileChangeApprovalDecision
) {
  return await dualVoid(
    'respond_to_file_change_approval',
    { requestId, decision },
    '/api/codex/approval/file-change',
    { request_id: requestId, decision }
  );
}

export async function preventSleep(conversationId?: string | null) {
  await dualVoid(
    'prevent_sleep',
    { conversationId: conversationId ?? null },
    '/api/sleep/prevent',
    { conversation_id: conversationId ?? null }
  );
}

export async function allowSleep(conversationId?: string | null) {
  await dualVoid('allow_sleep', { conversationId: conversationId ?? null }, '/api/sleep/allow', {
    conversation_id: conversationId ?? null,
  });
}

export async function listOtherModels() {
  return await dualGet<FrontendProviderModels[]>(
    'list_other_models',
    undefined,
    '/api/codex/model/list-other'
  );
}

export async function listProviderPresets() {
  return await dualGet<ProviderPreset[]>(
    'list_provider_presets',
    undefined,
    '/api/codex/provider/presets'
  );
}

// Persists the provider into the user's codex config.toml.
export async function addModelProvider(params: {
  provider: string;
  baseUrl: string;
  envKey: string;
}) {
  await dualVoid(
    'add_model_provider',
    { provider: params.provider, baseUrl: params.baseUrl, envKey: params.envKey },
    '/api/codex/provider/add',
    { provider: params.provider, base_url: params.baseUrl, env_key: params.envKey }
  );
}

// Providers actually present in the user's config.toml.
export async function listConfigProviders() {
  return await dualGet<ConfigProvider[]>(
    'list_config_providers',
    undefined,
    '/api/codex/provider/list'
  );
}

export async function removeModelProvider(provider: string) {
  await dualVoid('remove_model_provider', { provider }, '/api/codex/provider/remove', { provider });
}

export async function loadEnvKeys() {
  if (isDesktopTauri()) {
    return await invokeTauri<EnvStatusItem[]>('load_env_keys');
  }
  return null;
}

export async function setEnv(key: string, value: string) {
  if (isDesktopTauri()) {
    return await invokeTauri('set_env', { key, value });
  }
  return null;
}

export async function threadGoalSet(params: ThreadGoalSetParams) {
  return await dual<ThreadGoalSetResponse>(
    'thread_goal_set',
    { params },
    '/api/codex/thread/goal/set',
    params
  );
}

export async function threadGoalGet(params: ThreadGoalGetParams) {
  return await dual<ThreadGoalGetResponse>(
    'thread_goal_get',
    { params },
    '/api/codex/thread/goal/get',
    params
  );
}

export async function threadGoalClear(params: ThreadGoalClearParams) {
  return await dual<ThreadGoalClearResponse>(
    'thread_goal_clear',
    { params },
    '/api/codex/thread/goal/clear',
    params
  );
}

export async function pluginList(params: PluginListParams) {
  return await dual<PluginListResponse>(
    'plugin_list',
    { params },
    '/api/codex/plugin/list',
    params
  );
}

export async function pluginRead(params: PluginReadParams) {
  return await dual<PluginReadResponse>(
    'plugin_read',
    { params },
    '/api/codex/plugin/read',
    params
  );
}

export async function pluginInstall(params: PluginInstallParams) {
  return await dual<PluginInstallResponse>(
    'plugin_install',
    { params },
    '/api/codex/plugin/install',
    params
  );
}

export async function pluginUninstall(params: PluginUninstallParams) {
  return await dual<PluginUninstallResponse>(
    'plugin_uninstall',
    { params },
    '/api/codex/plugin/uninstall',
    params
  );
}
