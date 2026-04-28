import { ccListSessions } from '@/services';

type GetSessionsOptions = {
  limit?: number;
  offset?: number;
  includeWorktrees?: boolean;
};

export type SdkSessionInfo = {
  session_id: string;
  summary: string;
  last_modified: number;
  cwd?: string | null;
  file_size?: number | null;
  custom_title?: string | null;
  first_prompt?: string | null;
  git_branch?: string | null;
  tag?: string | null;
  created_at?: number | null;
};

export type SessionListResult = {
  sessions: SdkSessionInfo[];
  total: number;
};

export async function listSessions(
  directory?: string | null,
  options: GetSessionsOptions = {},
): Promise<SessionListResult> {
  try {
    const result = await ccListSessions<SdkSessionInfo>(directory, options);
    return {
      sessions: result.sessions.filter((s) => Boolean(s.session_id)),
      total: result.total,
    };
  } catch (err) {
    console.debug('Failed to get sessions:', err);
    return { sessions: [], total: 0 };
  }
}
