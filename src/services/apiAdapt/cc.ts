import { dual, dualGet, dualVoid } from './shared';

export async function ccNewSession(options: Record<string, unknown>) {
  return await dual<string>('cc_new_session', { options }, '/api/cc/new-session', { options });
}

export async function ccSendMessage(sessionId: string, message: string, imagePaths: string[] = []) {
  const trimmed = message.trim();
  await dualVoid(
    'cc_send_message',
    { sessionId, message: trimmed, imagePaths },
    '/api/cc/send-message',
    { session_id: sessionId, message: trimmed, image_paths: imagePaths }
  );
}

export async function ccInterrupt(sessionId: string) {
  await dualVoid('cc_interrupt', { sessionId }, '/api/cc/interrupt', { session_id: sessionId });
}

export async function ccResumeSession(sessionId: string, options: Record<string, unknown>) {
  await dualVoid('cc_resume_session', { sessionId, options }, '/api/cc/resume-session', {
    session_id: sessionId,
    options,
  });
}

export async function ccGetInstalledSkills() {
  return await dualGet<string[]>('cc_get_installed_skills', undefined, '/api/cc/installed-skills');
}

export async function ccGetSlashCommands(cwd?: string) {
  const qs = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
  return await dualGet<string[]>(
    'cc_get_slash_commands',
    { cwd: cwd ?? null },
    `/api/cc/slash-commands${qs}`
  );
}

type CcListSessionsOptions = {
  limit?: number;
  offset?: number;
  includeWorktrees?: boolean;
};

export type CcSessionListResult<T> = { sessions: T[]; total: number };

export async function ccListSessions<T = unknown>(
  directory?: string | null,
  options: CcListSessionsOptions = {}
) {
  const { offset = 0, includeWorktrees = true, limit } = options;

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
  return await dualGet<CcSessionListResult<T>>(
    'cc_list_sessions',
    { directory: directory ?? null, limit, offset, includeWorktrees },
    `/api/cc/sessions?${params.toString()}`
  );
}

export async function ccGetSettings<T = unknown>() {
  return await dualGet<T>('cc_get_settings', undefined, '/api/cc/settings');
}

export async function ccUpdateSettings(settings: unknown) {
  await dualVoid('cc_update_settings', { settings }, '/api/cc/settings', { settings });
}

export async function ccMcpAdd(request: unknown, workingDir: string) {
  await dual('cc_mcp_add', { request, workingDir }, '/api/cc/mcp/add', {
    request,
    working_dir: workingDir,
  });
}

export async function ccMcpList<T = unknown>(workingDir: string) {
  return await dual<T>('cc_mcp_list', { workingDir }, '/api/cc/mcp/list', {
    working_dir: workingDir,
  });
}

export async function ccMcpGet<T = unknown>(name: string, workingDir: string) {
  return await dual<T>('cc_mcp_get', { name, workingDir }, '/api/cc/mcp/get', {
    name,
    working_dir: workingDir,
  });
}

export async function ccListProjects() {
  return await dualGet<string[]>('cc_list_projects', undefined, '/api/cc/mcp/projects');
}

export async function ccMcpRemove(name: string, workingDir: string, scope = 'local') {
  await dual('cc_mcp_remove', { name, workingDir, scope }, '/api/cc/mcp/remove', {
    name,
    working_dir: workingDir,
    scope,
  });
}

export async function ccMcpEnable(name: string, workingDir: string) {
  await dual('cc_mcp_enable', { name, workingDir }, '/api/cc/mcp/enable', {
    name,
    working_dir: workingDir,
  });
}

export async function ccMcpDisable(name: string, workingDir: string) {
  await dual('cc_mcp_disable', { name, workingDir }, '/api/cc/mcp/disable', {
    name,
    working_dir: workingDir,
  });
}

export async function ccDeleteSession(sessionId: string): Promise<void> {
  await dualVoid('cc_delete_session', { sessionId }, '/api/cc/delete-session', {
    session_id: sessionId,
  });
}

export interface SdkSessionMessage {
  type: 'user' | 'assistant';
  uuid: string;
  session_id: string;
  message?: Record<string, unknown> | null;
  parent_tool_use_id?: string | null;
}

export async function ccGetSessionMessages(sessionId: string): Promise<SdkSessionMessage[]> {
  return await dual<SdkSessionMessage[]>(
    'cc_get_session_messages',
    { sessionId },
    '/api/cc/session-messages',
    { session_id: sessionId }
  );
}

export async function ccResolvePermission(requestId: string, decision: string): Promise<void> {
  await dualVoid('cc_resolve_permission', { requestId, decision }, '/api/cc/resolve-permission', {
    request_id: requestId,
    decision,
  });
}

export async function ccSetPermissionMode(sessionId: string, mode: string) {
  await dualVoid('cc_set_permission_mode', { sessionId, mode }, '/api/cc/set-permission-mode', {
    session_id: sessionId,
    mode,
  });
}
