import { useEffect, useRef, useState } from 'react';
import type { ThreadUsage } from '@/bindings/v2';
import { accountUsageRead } from '@/services';

const REFRESH_DELAY_MS = 800;

/**
 * Reads the estimated usage of a thread via `account/usage/read`.
 *
 * Fetches when the thread changes and, debounced, whenever `refreshKey` changes
 * (token usage updates arrive during a turn). Out-of-date responses are ignored
 * and failures simply yield no usage.
 */
export function useThreadUsage(threadId: string | null, refreshKey: number): ThreadUsage | null {
  const [state, setState] = useState<{ threadId: string; usage: ThreadUsage | null } | null>(null);
  const loadedThread = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is a refetch trigger
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    const delay = loadedThread.current === threadId ? REFRESH_DELAY_MS : 0;
    const timer = setTimeout(() => {
      loadedThread.current = threadId;
      accountUsageRead({ threadId })
        .then((response) => {
          if (!cancelled) setState({ threadId, usage: response.threadUsage ?? null });
        })
        .catch(() => {
          if (!cancelled) setState({ threadId, usage: null });
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [threadId, refreshKey]);

  return state && state.threadId === threadId ? state.usage : null;
}
