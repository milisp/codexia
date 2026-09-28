import { getJsonWithOptions, postJson, postJsonWithOptions } from './shared';

export type ConnectStart = { code: string; confirmCode: string; url: string };

export type PublishedGame = {
  username: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  cover_key: string | null;
  genre: string | null;
  dimension: string | null;
  current_version: number;
  plays: number;
  updated_at: string;
};

export type ProductshipAccount = {
  user: {
    id: string;
    /** Null for connections made before usernames existed; reconnect to pick one. */
    username: string | null;
    usernameLocked: boolean;
    name: string | null;
    avatarUrl: string | null;
  };
  games: PublishedGame[];
};

export type PublishGameParams = {
  cwd: string;
  buildCommand?: string | null;
  outputDir: string;
  slug: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  genre?: string | null;
  dimension?: string | null;
  coverPath?: string | null;
};

export type PublishGameResult = {
  version: number;
  playUrl: string;
  pageUrl: string;
  fileCount: number;
  totalBytes: number;
};

export type PublishProgress = {
  slug: string;
  stage: 'build' | 'scan' | 'upload' | 'finalize';
  message: string;
  done: number;
  total: number;
};

export async function publishConnectStart() {
  return await postJson<ConnectStart>('/api/publish/connect/start');
}

export async function publishConnectPoll(code: string) {
  return await postJsonWithOptions<{ approved: boolean }>(
    '/api/publish/connect/poll',
    { code },
    { suppressToast: true }
  );
}

export async function publishDisconnect() {
  await postJson<{ ok: boolean }>('/api/publish/disconnect');
}

export async function publishWhoami() {
  return await getJsonWithOptions<{ account: ProductshipAccount | null }>('/api/publish/whoami', {
    suppressToast: true,
  });
}

/** Builds, uploads and releases a game; progress arrives as `publish:progress` events. */
export async function publishGame(params: PublishGameParams) {
  return await postJsonWithOptions<PublishGameResult>('/api/publish/game', params, {
    suppressToast: true,
  });
}
