import { useCallback, useEffect, useState } from 'react';
import { listSessions } from '@/lib/sessions';
import { listThreads } from '@/services/apiAdapt';

const CACHE_MS = 30_000;
const WORKTREE_MARKERS = ['/.codex/worktrees/', '/.claude/worktrees/', '/.codexia/worktrees/'];

let cache: { at: number; projects: string[] } | null = null;
let inflight: Promise<string[]> | null = null;

/** Seconds and milliseconds both appear in session timestamps; compare in ms. */
const toMs = (t: number) => (t < 1e12 ? t * 1000 : t);

async function discover(): Promise<{ projects: string[]; complete: boolean }> {
  const [codex, cc] = await Promise.allSettled([
    listThreads({ limit: 200, sortKey: 'updated_at', useStateDbOnly: true }),
    listSessions(null, { limit: 300, includeWorktrees: false }),
  ]);

  const latest = new Map<string, number>();
  const seen = (cwd: string | null | undefined, at: number) => {
    const path = cwd?.trim();
    if (!path || WORKTREE_MARKERS.some((m) => path.includes(m))) return;
    latest.set(path, Math.max(latest.get(path) ?? 0, toMs(at)));
  };
  if (codex.status === 'fulfilled') {
    for (const thread of codex.value.data) seen(thread.cwd, thread.updatedAt);
  }
  if (cc.status === 'fulfilled') {
    for (const session of cc.value.sessions) seen(session.cwd, session.last_modified);
  }

  const projects = [...latest.entries()].sort((a, b) => b[1] - a[1]).map(([path]) => path);
  // Codex rejects calls until its app-server is up; don't cache a partial list.
  return { projects, complete: codex.status === 'fulfilled' && cc.status === 'fulfilled' };
}

function loadSessionProjects(): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.projects);
  inflight ??= discover()
    .then(({ projects, complete }) => {
      if (complete) cache = { at: Date.now(), projects };
      return projects;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Folders that existing Codex and Claude Code sessions ran in, most recently
 * used first, so a fresh install can offer projects the user already works on.
 */
export function useSessionProjects() {
  const [projects, setProjects] = useState<string[]>(cache?.projects ?? []);

  const refresh = useCallback(() => {
    loadSessionProjects()
      .then(setProjects)
      .catch((error) => console.debug('Failed to discover session projects:', error));
  }, []);

  useEffect(refresh, [refresh]);

  return { projects, refresh };
}
