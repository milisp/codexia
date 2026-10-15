import type { AcpSessionRecord } from './acp';
import { postJson } from './shared';

/** How much a bot may do on its own. Maps onto keke's approval policy and sandbox mode. */
export type BotTrustLevel = 'read_only' | 'ask' | 'autonomous';

/**
 * A bot as the database stores it. The list-shaped fields arrive as JSON
 * strings, exactly as the column holds them — use `parseBotList` to read one.
 */
export type Bot = {
  id: string;
  name: string;
  title: string | null;
  avatar: string;
  color: string;
  agentId: string;
  provider: string | null;
  model: string | null;
  reasoningEffort: string | null;
  cwd: string;
  systemPrompt: string | null;
  trustLevel: BotTrustLevel;
  approvedTools: string;
  mcpServers: string;
  allowedBotIds?: string;
  pinned: boolean;
  archived: boolean;
  notificationsEnabled: boolean;
  unreadCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A stored JSON array column. A corrupt value reads as empty rather than throwing. */
export function parseBotList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Only the fields being changed. Anything omitted keeps its stored value. */
export type BotPatch = Partial<{
  name: string;
  title: string;
  avatar: string;
  color: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  cwd: string;
  systemPrompt: string;
  trustLevel: BotTrustLevel;
  approvedTools: string[];
  mcpServers: string[];
  allowedBotIds: string[];
  pinned: boolean;
  archived: boolean;
  notificationsEnabled: boolean;
  unreadCount: number;
  lastViewedAt: string;
}>;

export async function listBots(includeArchived = false) {
  return await postJson<Bot[]>('/api/bots/list', { include_archived: includeArchived });
}

export async function createBot(params: {
  id: string;
  name: string;
  avatar: string;
  color: string;
  cwd: string;
  agentId?: string;
  trustLevel?: BotTrustLevel;
}) {
  return await postJson<Bot>('/api/bots/create', params);
}

export async function updateBot(id: string, patch: BotPatch) {
  return await postJson<Bot>('/api/bots/update', { id, ...patch });
}

export async function deleteBot(id: string) {
  await postJson<null>('/api/bots/delete', { id });
}

/** A bot's conversations, newest first. Reads the database only. */
export async function listBotSessions(botId: string, limit?: number) {
  return await postJson<AcpSessionRecord[]>('/api/bots/sessions', { botId, limit });
}

/** One unattended run (a routine, another bot asking), as Today lists it. */
export type BotRun = {
  runId: string;
  botId: string;
  sessionId: string | null;
  triggerKind: string;
  triggerName: string | null;
  status: 'working' | 'waiting' | 'done' | 'blocked' | 'failed';
  /** The start of the bot's reply (or the error) once the run has finished. */
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
};

/** Recent runs of every bot, newest first. Reads the database only. */
export async function listBotRuns(limit?: number) {
  return await postJson<BotRun[]>('/api/bots/runs', { limit });
}

/** A draft to review before anything is sent, or a step handed back to you. */
export type BotInboxItem = {
  id: string;
  botId: string;
  sessionId: string;
  kind: 'draft' | 'handback';
  title: string;
  /** The draft text, or the steps to take (Markdown). */
  body: string;
  /** Draft: what Send does (absent: copy only). Hand-back: a link, if any. */
  action: string | null;
  status: 'open' | 'sent' | 'discarded' | 'done' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
};

/** Open drafts and hand-backs, oldest first, for one bot or all of them. */
export async function listBotInbox(botId?: string) {
  return await postJson<BotInboxItem[]>('/api/bots/inbox', { botId });
}

/**
 * Act on an inbox item. `send` and `done` continue the bot's conversation in
 * the background, under its usual approval rules.
 */
export async function resolveBotInbox(params: {
  id: string;
  action: 'send' | 'discard' | 'done' | 'dismiss';
  body?: string;
  note?: string;
}) {
  return await postJson<BotInboxItem>('/api/bots/inbox/resolve', params);
}
