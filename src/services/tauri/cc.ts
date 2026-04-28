import { invokeTauri, isDesktopTauri, postNoContent, postJson, getJson } from './shared';

export async function ccNewSession(options: Record<string, unknown>) {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('cc_new_session', { options });
  }
  return await postJson<string>('/api/cc/new-session', { options });
}

export async function ccSendMessage(sessionId: string, message: string, imagePaths: string[] = []) {
  const trimmed = message.trim();
  if (isDesktopTauri()) {
    await invokeTauri('cc_send_message', { sessionId, message: trimmed, imagePaths });
    return;
  }
  await postNoContent('/api/cc/send-message', {
    session_id: sessionId,
    message: trimmed,
    image_paths: imagePaths,
  });
}

export async function ccInterrupt(sessionId: string) {
  if (isDesktopTauri()) {
    await invokeTauri('cc_interrupt', { sessionId });
    return;
  }
  await postNoContent('/api/cc/interrupt', { session_id: sessionId });
}

export async function ccResumeSession(sessionId: string, options: Record<string, unknown>) {
  if (isDesktopTauri()) {
    await invokeTauri('cc_resume_session', { sessionId, options });
    return;
  }
  await postNoContent('/api/cc/resume-session', { session_id: sessionId, options });
}

export async function ccGetInstalledSkills() {
  if (isDesktopTauri()) {
    return await invokeTauri<string[]>('cc_get_installed_skills');
  }
  return await getJson<string[]>('/api/cc/installed-skills');
}

export async function ccGetSlashCommands(cwd?: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<string[]>('cc_get_slash_commands', { cwd: cwd ?? null });
  }
  const qs = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
  return await getJson<string[]>(`/api/cc/slash-commands${qs}`);
}

type CcListSessionsOptions = {
  limit?: number;
  offset?: number;
  includeWorktrees?: boolean;
};

export type CcSessionListResult<T> = { sessions: T[]; total: number };

export async function ccListSessions<T = unknown>(directory?: string | null, options: CcListSessionsOptions = {}) {
  const {
    offset = 0,
    includeWorktrees = true,
    limit,
  } = options;

  if (isDesktopTauri()) {
    return await invokeTauri<CcSessionListResult<T>>('cc_list_sessions', {
      directory: directory ?? null,
      limit,
      offset,
      includeWorktrees,
    });
  }
  const params = new URLSearchParams({
    offset: String(offset),
    includeWorktrees: String(includeWorktrees),
  });
  if (directory) {
    params.set('directory', directory);
  }
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }
  return await getJson<CcSessionListResult<T>>(`/api/cc/sessions?${params.toString()}`);
}

export async function ccGetSettings<T = unknown>() {
  if (isDesktopTauri()) {
    return await invokeTauri<T>('cc_get_settings');
  }
  return await getJson<T>('/api/cc/settings');
}

export async function ccUpdateSettings(settings: unknown) {
  if (isDesktopTauri()) {
    await invokeTauri('cc_update_settings', { settings });
    return;
  }
  await postNoContent('/api/cc/settings', { settings });
}

export async function ccMcpAdd(request: unknown, workingDir: string) {
  if (isDesktopTauri()) {
    await invokeTauri('cc_mcp_add', { request, workingDir });
    return;
  }
  await postJson('/api/cc/mcp/add', { request, working_dir: workingDir });
}

export async function ccMcpList<T = unknown>(workingDir: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<T>('cc_mcp_list', { workingDir });
  }
  return await postJson<T>('/api/cc/mcp/list', { working_dir: workingDir });
}

export async function ccMcpGet<T = unknown>(name: string, workingDir: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<T>('cc_mcp_get', { name, workingDir });
  }
  return await postJson<T>('/api/cc/mcp/get', { name, working_dir: workingDir });
}

export async function ccListProjects() {
  if (isDesktopTauri()) {
    return await invokeTauri<string[]>('cc_list_projects');
  }
  return await getJson<string[]>('/api/cc/mcp/projects');
}

export async function ccMcpRemove(name: string, workingDir: string, scope = 'local') {
  if (isDesktopTauri()) {
    await invokeTauri('cc_mcp_remove', { name, workingDir, scope });
    return;
  }
  await postJson('/api/cc/mcp/remove', { name, working_dir: workingDir, scope });
}

export async function ccMcpEnable(name: string, workingDir: string) {
  if (isDesktopTauri()) {
    await invokeTauri('cc_mcp_enable', { name, workingDir });
    return;
  }
  await postJson('/api/cc/mcp/enable', { name, working_dir: workingDir });
}

export async function ccMcpDisable(name: string, workingDir: string) {
  if (isDesktopTauri()) {
    await invokeTauri('cc_mcp_disable', { name, workingDir });
    return;
  }
  await postJson('/api/cc/mcp/disable', { name, working_dir: workingDir });
}

export async function ccDeleteSession(sessionId: string): Promise<void> {
  if (isDesktopTauri()) {
    await invokeTauri('cc_delete_session', { sessionId });
    return;
  }
  await postNoContent('/api/cc/delete-session', { session_id: sessionId });
}

export interface SdkSessionMessage {
  type: 'user' | 'assistant';
  uuid: string;
  session_id: string;
  message?: Record<string, unknown> | null;
  parent_tool_use_id?: string | null;
}

export async function ccGetSessionMessages(sessionId: string): Promise<SdkSessionMessage[]> {
  if (isDesktopTauri()) {
    return await invokeTauri<SdkSessionMessage[]>('cc_get_session_messages', { sessionId });
  }
  return await postJson<SdkSessionMessage[]>('/api/cc/session-messages', { session_id: sessionId });
}

export async function ccResolvePermission(requestId: string, decision: string): Promise<void> {
  if (isDesktopTauri()) {
    return invokeTauri('cc_resolve_permission', { requestId, decision });
  }
  await postNoContent('/api/cc/resolve-permission', { request_id: requestId, decision });
}

export async function ccSetPermissionMode(sessionId: string, mode: string) {
  if (isDesktopTauri()) {
    await invokeTauri('cc_set_permission_mode', { sessionId, mode });
    return;
  }
  await postNoContent('/api/cc/set-permission-mode', { session_id: sessionId, mode });
}
