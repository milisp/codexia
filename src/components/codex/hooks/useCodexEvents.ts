import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  useCodexStore,
  useApprovalStore,
  useRequestUserInputStore,
  type ApprovalRequest,
  type RequestUserInputRequest,
} from '@/components/codex/stores';
import { useLayoutStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { AccountLoginCompletedNotification } from '@/bindings/v2';
import { playBeep } from '@/utils/beep';
import { allowSleep, preventSleep } from '@/services/tauri';
import { getAccountWithParams } from '@/services';
import { buildUrl, isDesktopTauri } from '@/hooks/runtime';
import { CodexParseErrorEvent, CodexStderrEvent } from '@/components/codex/CodexInternalEvent';

function shouldPlayCompletionBeep(
  mode: 'never' | 'unfocused' | 'always',
  isCodexThreadActive: boolean
) {
  if (mode === 'never') {
    return false;
  }
  if (mode === 'always') {
    return true;
  }
  return document.hidden || !document.hasFocus() || !isCodexThreadActive;
}

const extractThreadId = (payload: ServerNotification): string | undefined => {
  if ('threadId' in payload.params && typeof payload.params.threadId === 'string') {
    return payload.params.threadId;
  }
  if ('thread' in payload.params) {
    const threadCandidate = payload.params.thread as { id?: unknown } | null | undefined;
    if (threadCandidate && typeof threadCandidate.id === 'string') {
      return threadCandidate.id;
    }
  }
  return undefined;
};

export function useCodexEvents(enabled = true) {
  // Read volatile values via refs so the effect never needs to re-run when
  // they change — re-registering Tauri listeners on every store update or
  // layout change (e.g. window resize) was causing listeners to drop.
  const isCodexThreadActiveRef = useRef(false);
  const taskCompleteBeepModeRef = useRef<'never' | 'unfocused' | 'always'>('unfocused');
  const preventSleepDuringTasksRef = useRef(false);

  // Keep refs in sync with current store values on every render (cheap).
  isCodexThreadActiveRef.current = useLayoutStore((state) => state.view === 'agent');
  taskCompleteBeepModeRef.current = useSettingsStore((state) => state.enableTaskCompleteBeep);
  preventSleepDuringTasksRef.current = useSettingsStore((state) => state.preventSleepDuringTasks);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Access store actions via getState() — these are stable function references
    // defined once in the Zustand store initializer, so they don't need to be in
    // the dependency array. Subscribing to them via useCodexStore() was causing
    // the effect to re-run (and drop/re-register listeners) on every store update
    // or layout change such as a window resize.
    const getAddEvent = () => useCodexStore.getState().addEvent;
    const getAddApproval = () => useApprovalStore.getState().addApproval;
    const getAddRequest = () => useRequestUserInputStore.getState().addRequest;

    const syncAccountState = async (refreshToken: boolean) => {
      try {
        const response = await getAccountWithParams({ refreshToken });
        useCodexStore.getState().setHasAccount(Boolean(response.account));
      } catch (error) {
        console.error('[useCodexEvents] Failed to sync account state:', error);
        useCodexStore.getState().setHasAccount(false);
      }
    };

    void syncAccountState(false);

    const handleServerNotification = (payload: ServerNotification) => {
      const method = payload.method;
      if (method === 'account/updated') {
        void syncAccountState(true);
      }

      if (method === 'account/login/completed') {
        const loginCompleted = payload.params as AccountLoginCompletedNotification;
        if (loginCompleted.success) {
          void syncAccountState(true);
        }
      }

      if (
        ![
          'rawResponseItem/completed',
          'account/rateLimits/updated',
          'item/agentMessage/delta',
          'item/plan/delta',
          'item/fileChange/outputDelta',
          'item/commandExecution/outputDelta',
          'item/commandExecution/terminalInteraction',
          'thread/tokenUsage/updated',
        ].includes(method)
      ) {
        console.log(`[useCodexEvents] ${method}:`, payload.params);
      }

      const threadId = extractThreadId(payload);

      if (threadId) {
        if (['thread/settings/updated', 'serverRequest/resolved', 'mcpServer/startupStatus/updated'].includes(method)) {
          return;
        }

        if (method === 'thread/started') {
          const startedThread = payload.params.thread;
          const startedThreadId = startedThread.id;
          const startedThreadCwd = startedThread.cwd;
          if (startedThreadId && startedThreadCwd) {
            useCodexStore.setState((state) => ({
              threads: state.threads.map((thread) =>
                thread.id === startedThreadId ? { ...thread, cwd: startedThreadCwd } : thread
              ),
            }));
          }
        }

        if (method === 'thread/name/updated') {
          const { threadId: renamedThreadId, threadName } = payload.params;
          useCodexStore.setState((state) => ({
            threads: state.threads.map((thread) =>
              thread.id === renamedThreadId
                ? { ...thread, preview: threadName ?? thread.preview }
                : thread
            ),
          }));
        }

        if (preventSleepDuringTasksRef.current && method === 'turn/started') {
          void preventSleep(threadId).catch((error) => {
            console.warn('[useCodexEvents] preventSleep failed:', error);
          });
        }

        if (method === 'turn/completed') {
          void allowSleep(threadId).catch((error) => {
            console.warn('[useCodexEvents] allowSleep failed:', error);
          });

          const turnStatus = payload.params.turn.status;
          if (
            turnStatus === 'completed' &&
            shouldPlayCompletionBeep(taskCompleteBeepModeRef.current, isCodexThreadActiveRef.current)
          ) {
            playBeep();
          }
        }

        if (method === 'error') {
          void allowSleep(threadId).catch((error) => {
            console.warn('[useCodexEvents] allowSleep failed:', error);
          });
        }

        getAddEvent()(threadId, payload);
      } else {
        if (
          !['account/rateLimits/updated', 'account/updated', 'error', 'account/login/completed'].includes(method)
        ) {
          console.warn('[useCodexEvents] No threadId found in payload:', payload);
        }
      }
    };

    if (isDesktopTauri()) {
      console.log('[useCodexEvents] Setting up Tauri event listeners...');

      // Collect resolved unlisten functions synchronously as promises settle.
      // Using a cancelled flag ensures we don't register listeners after cleanup.
      let cancelled = false;
      const unlisteners: (() => void)[] = [];

      const registerListener = async <T>(
        event: string,
        handler: (event: { payload: T }) => void
      ) => {
        const unlisten = await listen<T>(event, handler);
        if (cancelled) {
          unlisten();
        } else {
          unlisteners.push(unlisten);
        }
      };

      void registerListener<ApprovalRequest>('codex/approval-request', (event) => {
        getAddApproval()(event.payload);
      });

      void registerListener<RequestUserInputRequest>('codex/request-user-input', (event) => {
        getAddRequest()(event.payload);
      });

      void registerListener<ServerNotification>('codex:notification', (event) => {
        handleServerNotification(event.payload);
      });

      void registerListener<CodexStderrEvent>('codex:stderr', (event) => {
        console.error('[useCodexEvents] codex stderr:', event.payload.message);
      });

      void registerListener<CodexParseErrorEvent>('codex:parseError', (event) => {
        console.error('[useCodexEvents] codex parseError:', event.payload.error, event.payload.raw);
      });

      return () => {
        cancelled = true;
        unlisteners.forEach((unlisten) => unlisten());
      };
    }

    console.log('[useCodexEvents] Setting up SSE event bridge...');

    const handleEnvelope = (data: string) => {
      try {
        const envelope = JSON.parse(data) as { event?: string; payload?: unknown };
        if (!envelope.event) return;

        if (envelope.event === 'fs_change') {
          window.dispatchEvent(new CustomEvent('fs_change', { detail: envelope.payload }));
          return;
        }
        if (envelope.event === 'codex/approval-request') {
          getAddApproval()(envelope.payload as ApprovalRequest);
          return;
        }
        if (envelope.event === 'codex/request-user-input') {
          getAddRequest()(envelope.payload as RequestUserInputRequest);
          return;
        }
        if (envelope.event === 'codex:notification') {
          handleServerNotification(envelope.payload as ServerNotification);
        }
      } catch (error) {
        console.warn('[useCodexEvents] Failed to parse SSE message:', error);
      }
    };

    // EventSource auto-reconnects on error/close — no manual retry needed.
    const es = new EventSource(buildUrl('/api/events'));
    es.onmessage = (e) => handleEnvelope(e.data as string);
    es.onerror = () => console.warn('[useCodexEvents] SSE error — will auto-reconnect');

    return () => {
      es.close();
    };
  }, [enabled]);
}
