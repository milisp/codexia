import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerNotification } from '@/bindings';
import { useCodexStore } from '@/components/codex/stores';
import { buildWsUrl, isDesktopTauri } from '@/hooks/runtime';
import { listAutomationRuns } from '@/services/tauri';

type RunMeta = {
  threadId: string;
  taskId: string;
  taskName: string;
  startedAt: string;
  status?: string;
};

type AutomationRunStartedPayload = {
  taskId: string;
  taskName: string;
  threadId: string;
  startedAt: string;
};

/** Map from taskId → ordered list of run metadata (most recent first) */
type RunMetaByTask = Record<string, RunMeta[]>;

const MAX_RUNS_PER_TASK = 10;
const EMPTY_RUNS: RunMeta[] = [];
const EMPTY_EVENTS: ServerNotification[] = [];

/**
 * Tracks which threads belong to which automation task.
 * Events for those threads are read directly from useCodexStore,
 * so renderEvent() can be used for full fidelity rendering.
 */
export function useAutomationRuns() {
  const [runMetaByTask, setRunMetaByTask] = useState<RunMetaByTask>({});
  // threadId → taskId reverse lookup (ref to avoid re-renders)
  const threadToTask = useRef<Record<string, string>>({});

  useEffect(() => {
    const mapping: Record<string, string> = {};
    for (const [taskId, runs] of Object.entries(runMetaByTask)) {
      for (const run of runs) {
        mapping[run.threadId] = taskId;
      }
    }
    threadToTask.current = mapping;
  }, [runMetaByTask]);

  const loadRunsFromBackend = useCallback(async () => {
    try {
      const data = await listAutomationRuns({ limit: 200 });
      const next: RunMetaByTask = {};
      for (const run of data) {
        const taskId = run.task_id;
        const entry: RunMeta = {
          taskId,
          taskName: run.task_name,
          threadId: run.thread_id,
          startedAt: run.started_at,
          status: run.status,
        };
        const existing = next[taskId] ?? [];
        if (!existing.some((item) => item.threadId === entry.threadId)) {
          next[taskId] = [...existing, entry].slice(0, MAX_RUNS_PER_TASK);
        }
      }
      // Keep optimistic task buckets from `prev`, but prefer backend truth for overlapping task IDs.
      setRunMetaByTask((prev) => ({ ...prev, ...next }));
    } catch (error) {
      console.warn('[useAutomationRuns] Failed to load runs from backend:', error);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    void loadRunsFromBackend();
    const refreshTimer = setInterval(() => {
      if (!disposed) {
        void loadRunsFromBackend();
      }
    }, 3000);

    return () => {
      disposed = true;
      clearInterval(refreshTimer);
    };
  }, [loadRunsFromBackend]);

  const handleRunStarted = useCallback((payload: AutomationRunStartedPayload) => {
    const { taskId, taskName, threadId, startedAt } = payload;
    threadToTask.current[threadId] = taskId;

    setRunMetaByTask((prev) => {
      const existing = prev[taskId] ?? [];
      // Avoid duplicate (e.g. hot-reload)
      if (existing.some((r) => r.threadId === threadId)) return prev;
      const updated = [
        { threadId, taskId, taskName, startedAt, status: 'running' },
        ...existing,
      ].slice(0, MAX_RUNS_PER_TASK);
      return { ...prev, [taskId]: updated };
    });
  }, []);

  useEffect(() => {
    if (isDesktopTauri()) {
      const unlistenPromise = listen<AutomationRunStartedPayload>(
        'automation:run/started',
        (event) => handleRunStarted(event.payload)
      );

      return () => {
        unlistenPromise.then((fn) => fn());
      };
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;

    const connectWebSocket = () => {
      ws = new WebSocket(buildWsUrl('/ws'));

      ws.onmessage = (messageEvent) => {
        try {
          const envelope = JSON.parse(messageEvent.data as string) as {
            event?: string;
            payload?: unknown;
          };
          if (envelope.event !== 'automation:run/started' || !envelope.payload) {
            return;
          }
          handleRunStarted(envelope.payload as AutomationRunStartedPayload);
        } catch (error) {
          console.warn('[useAutomationRuns] Failed to parse websocket message:', error);
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        reconnectTimer = setTimeout(connectWebSocket, 1000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connectWebSocket();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      ws?.close();
    };
  }, [handleRunStarted]);

  const getRunsForTask = (taskId: string): RunMeta[] => runMetaByTask[taskId] ?? EMPTY_RUNS;
  return { getRunsForTask };
}

/** Returns the codex events for a specific automation thread. */
export function useRunEvents(threadId: string) {
  return useCodexStore((state) => state.events[threadId] ?? EMPTY_EVENTS);
}

export type { RunMeta };
