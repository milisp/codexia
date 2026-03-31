import type {
  GetAccountParams,
  GetAccountRateLimitsResponse,
  GetAccountResponse,
  LoginAccountParams,
  LoginAccountResponse,
  ModelListParams,
  ModelListResponse,
  ReviewStartParams,
  ReviewStartResponse,
  ThreadForkParams,
  ThreadForkResponse,
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
} from '@/bindings/v2';
import type {
  CommandExecutionApprovalDecision,
  FileChangeApprovalDecision,
} from '@/bindings/v2';
import type {
  RequestId,
  ThreadId,
} from '@/bindings';

import {
  getJson,
  invokeTauri,
  isDesktopTauri,
  postJson,
  postNoContent,
  toast,
} from './shared';
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
  if (isDesktopTauri()) {
    return await invokeTauri<ModelListResponse>('model_list', { params });
  }
  return await postJson<ModelListResponse>('/api/codex/model/list', params);
}

export async function threadStart(params: ThreadStartParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<ThreadStartResponse>('start_thread', { params });
  }
  return await postJson<ThreadStartResponse>('/api/codex/thread/start', params);
}

export async function threadResume(params: ThreadResumeParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<ThreadResumeResponse>('resume_thread', { params });
  }
  return await postJson<ThreadResumeResponse>('/api/codex/thread/resume', params);
}

export async function threadFork(params: ThreadForkParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<ThreadForkResponse>('fork_thread', { params });
  }
  return await postJson<ThreadForkResponse>('/api/codex/thread/fork', params);
}

export async function threadRollback(params: ThreadRollbackParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<ThreadRollbackResponse>('rollback_thread', { params });
  }
  return await postJson<ThreadRollbackResponse>('/api/codex/thread/rollback', params);
}

export async function turnStart(params: TurnStartParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<TurnStartResponse>('turn_start', { params });
  }
  return await postJson<TurnStartResponse>('/api/codex/turn/start', params);
}

export async function turnInterrupt(params: TurnInterruptParams) {
  if (isDesktopTauri()) {
    return await invokeTauri('turn_interrupt', { params });
  }
  return await postJson('/api/codex/turn/interrupt', params);
}

export async function threadList(params: ThreadListParams, cwd?: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<ThreadListResponse>('list_threads', { params, cwd });
  }
  return await postJson<ThreadListResponse>('/api/codex/thread/list', { ...params, cwd });
}

export async function threadListArchived(params: ThreadListParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<ThreadListResponse>('list_archived_threads', { params });
  }
  return await postJson<ThreadListResponse>('/api/codex/thread/list-archived', params);
}

export async function threadArchive(threadId: ThreadId) {
  if (isDesktopTauri()) {
    return await invokeTauri('archive_thread', { threadId });
  }
  return await postJson('/api/codex/thread/archive', { threadId });
}

export async function threadUnarchive(threadId: ThreadId) {
  if (isDesktopTauri()) {
    return await invokeTauri('thread_unarchive', { threadId });
  }
  return await postJson('/api/codex/thread/unarchive', { thread_id: threadId });
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
  if (isDesktopTauri()) {
    return await invokeTauri<GetAccountResponse>('get_account', { params });
  }
  return await postJson<GetAccountResponse>('/api/codex/account/get', params);
}

export async function loginAccount(params: LoginAccountParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<LoginAccountResponse>('login_account', { params });
  }
  return await postJson<LoginAccountResponse>('/api/codex/account/login', params);
}

export async function reviewStart(params: ReviewStartParams) {
  if (isDesktopTauri()) {
    return await invokeTauri<ReviewStartResponse>('start_review', { params });
  }
  return await postJson<ReviewStartResponse>('/api/codex/review/start', params);
}

export async function getAccountRateLimits() {
  if (isDesktopTauri()) {
    return await invokeTauri<GetAccountRateLimitsResponse>('account_rate_limits');
  }
  return await getJson<GetAccountRateLimitsResponse>('/api/codex/account/rate-limits');
}

export async function respondToRequestUserInput(
  requestId: RequestId,
  response: unknown
) {
  if (isDesktopTauri()) {
    return await invokeTauri('respond_to_request_user_input', { requestId, response });
  }
  return await postNoContent('/api/codex/approval/user-input', {
    request_id: requestId,
    response,
  });
}

export async function respondToCommandExecutionApproval(
  requestId: RequestId,
  decision: CommandExecutionApprovalDecision
) {
  if (isDesktopTauri()) {
    return await invokeTauri('respond_to_command_execution_approval', { requestId, decision });
  }
  return await postNoContent('/api/codex/approval/command-execution', {
    request_id: requestId,
    decision,
  });
}

export async function respondToFileChangeApproval(
  requestId: RequestId,
  decision: FileChangeApprovalDecision
) {
  if (isDesktopTauri()) {
    return await invokeTauri('respond_to_file_change_approval', { requestId, decision });
  }
  return await postNoContent('/api/codex/approval/file-change', {
    request_id: requestId,
    decision,
  });
}

export async function preventSleep(conversationId?: string | null) {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('prevent_sleep', { conversationId: conversationId ?? null });
  }
  await postNoContent('/api/sleep/prevent', { conversation_id: conversationId ?? null });
}

export async function allowSleep(conversationId?: string | null) {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('allow_sleep', { conversationId: conversationId ?? null });
  }
  await postNoContent('/api/sleep/allow', { conversation_id: conversationId ?? null });
}