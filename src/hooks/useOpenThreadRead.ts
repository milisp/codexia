import { useEffect, useRef } from 'react';
import { isThreadUnread, useCodexStore, useThreadReadStateStore } from '@/components/codex/stores';
import { keptUnreadThreads, setThreadReadState } from '@/services/threadReadState';
import { useLayoutStore } from '@/stores';

/**
 * Marks the open Codex thread read on the server. The request carries the
 * revision we know; a thread that gets new activity while open arrives with a
 * new revision and is marked read again. Each revision is attempted once, so a
 * rejected update does not retry in a loop.
 */
export function useOpenThreadRead() {
  const view = useLayoutStore((s) => s.view);
  const currentThreadId = useCodexStore((s) => s.currentThreadId);
  const readState = useThreadReadStateStore((s) =>
    currentThreadId ? s.states[currentThreadId] : undefined
  );
  const attempted = useRef(new Set<string>());
  const previousThreadId = useRef<string | null>(null);

  useEffect(() => {
    // Switching away ends the "kept unread" exemption of the previous thread.
    if (previousThreadId.current && previousThreadId.current !== currentThreadId) {
      keptUnreadThreads.delete(previousThreadId.current);
    }
    previousThreadId.current = currentThreadId;

    if (view !== 'agent' || !currentThreadId || !readState) return;
    if (!isThreadUnread({ [currentThreadId]: readState }, currentThreadId)) return;
    if (keptUnreadThreads.has(currentThreadId)) return;
    const key = `${currentThreadId}:${readState.revision}`;
    if (attempted.current.has(key)) return;
    attempted.current.add(key);
    void setThreadReadState(currentThreadId, 'read', { silent: true });
  }, [view, currentThreadId, readState]);
}
