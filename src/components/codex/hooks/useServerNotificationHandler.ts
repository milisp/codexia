import { useCallback, type RefObject } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { AccountLoginCompletedNotification } from '@/bindings/v2';
import { useCodexStore } from '@/components/codex/stores';
import { allowSleep, preventSleep } from '@/services/tauri';
import { playBeep } from '@/utils/beep';
import { shouldPlayCompletionBeep } from './beepOnCompletion';

export type BeepMode = 'never' | 'unfocused' | 'always';

interface NotificationHandlerRefs {
  isCodexThreadActiveRef: RefObject<boolean>;
  taskCompleteBeepModeRef: RefObject<BeepMode>;
  preventSleepDuringTasksRef: RefObject<boolean>;
}

// Encapsulates all business logic for handling incoming ServerNotification
// events (thread/turn/account/item updates). Transport-agnostic: used by
// both the Tauri listener path and the SSE bridge path.
export function useServerNotificationHandler(
  refs: NotificationHandlerRefs,
  syncAccountState: (refreshToken: boolean) => Promise<void>
) {
  return useCallback(
    (payload: ServerNotification) => {
      const method = payload.method;
      let threadId = null;
      if (method === 'thread/started') {
        threadId = payload.params.thread.id;
      } else if ('threadId' in payload.params) {
        threadId = payload.params.threadId
      }

      if (method === 'account/updated') {
        void syncAccountState(true);
      }

      if (method === 'account/login/completed') {
        const loginCompleted = payload.params as AccountLoginCompletedNotification;
        if (loginCompleted.success) {
          void syncAccountState(true);
        }
      }

      if (threadId) {
        if (
          [
            'thread/settings/updated',
            'serverRequest/resolved',
            'mcpServer/startupStatus/updated',
          ].includes(method)
        ) {
          return;
        }

        if (method === 'thread/started') {
          const { cwd } = payload.params.thread;
          if (threadId && cwd) {
            useCodexStore.setState((state) => ({
              threads: state.threads.map((thread) =>
                thread.id === threadId ? { ...thread, cwd: cwd } : thread
              ),
            }));
          }
        }

        if (method === 'thread/name/updated') {
          const { threadName } = payload.params;
          useCodexStore.setState((state) => ({
            threads: state.threads.map((thread) =>
              thread.id === threadId
                ? { ...thread, preview: threadName ?? thread.preview }
                : thread
            ),
          }));
        }

        if (method === 'thread/tokenUsage/updated') {
          const { tokenUsage } = payload.params
          useCodexStore.getState().setTokenUsage(threadId, tokenUsage);
        }

        if (refs.preventSleepDuringTasksRef.current && method === 'turn/started') {
          void preventSleep(threadId).catch((error) => {
            console.warn('[useServerNotificationHandler] preventSleep failed:', error);
          });
        }

        if (method === 'turn/completed') {
          void allowSleep(threadId).catch((error) => {
            console.warn('[useServerNotificationHandler] allowSleep failed:', error);
          });

          const turnStatus = payload.params.turn.status;
          if (
            turnStatus === 'completed' &&
            shouldPlayCompletionBeep(
              refs.taskCompleteBeepModeRef.current,
              refs.isCodexThreadActiveRef.current
            )
          ) {
            playBeep();
          }
        }

        if (method === 'error') {
          void allowSleep(threadId).catch((error) => {
            console.warn('[useServerNotificationHandler] allowSleep failed:', error);
          });
        }

        // Forward every non-noise notification to the events slice so
        // derived state (turnTimingMap, threadStatusMap, goalMap, etc.)
        // stays in sync. The noise events are already filtered out above.
        useCodexStore.getState().addEvent(threadId, payload);
      }
    },
    // syncAccountState and refs are stable across renders (refs by identity,
    // syncAccountState is defined once per useCodexEvents call).
    [syncAccountState, refs]
  );
}
