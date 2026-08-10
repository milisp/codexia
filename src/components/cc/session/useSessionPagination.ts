// Handles fetching and paginating the session list for a directory.
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import { isDesktopTauri } from '@/hooks/runtime';
import { listSessions, type SdkSessionInfo } from '@/lib/sessions';

type AutomationRunStartedPayload = {
  agent?: string;
  taskName: string;
  threadId: string;
  startedAt: string;
  cwd?: string | null;
};

export const DEFAULT_VISIBLE = 3;
export const LOAD_MORE_SIZE = 20;

interface UseSessionPaginationArgs {
  directory: string;
  sessions?: SdkSessionInfo[];
}

export function useSessionPagination({ directory, sessions }: UseSessionPaginationArgs) {
  const [loadedSessions, setLoadedSessions] = useState<SdkSessionInfo[]>([]);
  const [loading, setLoading] = useState(sessions === undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Sync loading/error state when sessions prop changes (controlled mode)
  if (sessions !== undefined && (loading || error)) {
    setLoading(false);
    setError(null);
  }

  // Initial load: fetch the first page of sessions when running in
  // uncontrolled mode (no `sessions` prop supplied by the parent).
  useEffect(() => {
    if (sessions !== undefined) return;
    if (!directory) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { sessions: initial, total } = await listSessions(directory, {
          limit: LOAD_MORE_SIZE,
          offset: 0,
          includeWorktrees: true,
        });
        if (cancelled) return;
        setLoadedSessions(initial);
        setTotalCount(total);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [directory, sessions]);

  // An automation cc run creates a real CLI session in the backend. Show it right away
  // instead of waiting for the next full reload of this directory's list.
  useEffect(() => {
    if (sessions !== undefined || !directory || !isDesktopTauri()) return;
    const unlistenPromise = listen<AutomationRunStartedPayload>(
      'automation:run/started',
      (event) => {
        const { agent, threadId, taskName, cwd } = event.payload;
        if (agent !== 'cc' || cwd !== directory) return;
        setLoadedSessions((prev) => {
          if (prev.some((s) => s.session_id === threadId)) return prev;
          return [
            {
              session_id: threadId,
              summary: taskName,
              last_modified: Date.now(),
              cwd,
            },
            ...prev,
          ];
        });
        setTotalCount((prev) => prev + 1);
      }
    );
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [directory, sessions]);

  const loadMoreSessions = useCallback(async () => {
    if (!directory) return;
    setLoadingMore(true);
    try {
      const { sessions: extra, total } = await listSessions(directory, {
        limit: LOAD_MORE_SIZE,
        offset: loadedSessions.length,
        includeWorktrees: true,
      });
      setLoadedSessions((prev) => [...prev, ...extra]);
      setTotalCount(total);
      setExpanded(true);
    } finally {
      setLoadingMore(false);
    }
  }, [directory, loadedSessions.length]);

  const removeSession = useCallback((sessionId: string) => {
    setLoadedSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
  }, []);

  return {
    loadedSessions,
    loading,
    loadingMore,
    error,
    expanded,
    setExpanded,
    totalCount,
    loadMoreSessions,
    removeSession,
  };
}
