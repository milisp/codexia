import { useEffect, useRef } from 'react';
import { useApprovalStore, useCodexStore, useRequestUserInputStore } from '@/components/codex/stores';
import { isDesktopTauri } from '@/hooks/runtime';
import { getAccountWithParams } from '@/services';
import { useLayoutStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings';
import { useServerNotificationHandler } from './useServerNotificationHandler';
import { useSseEventBridge } from './useSseEventBridge';
import { useTauriEventListeners } from './useTauriEventListeners';

export function useCodexEvents(enabled = true) {
  // Read volatile values via refs so downstream hooks never need to re-run
  // their effects when they change — re-registering Tauri listeners on every
  // store update or layout change (e.g. window resize) was causing listeners
  // to drop.
  const isCodexThreadActiveRef = useRef(false);
  const taskCompleteBeepModeRef = useRef<'never' | 'unfocused' | 'always'>('unfocused');
  const preventSleepDuringTasksRef = useRef(false);

  // Keep refs in sync with current store values on every render (cheap).
  isCodexThreadActiveRef.current = useLayoutStore((state) => state.view === 'agent');
  taskCompleteBeepModeRef.current = useSettingsStore((state) => state.enableTaskCompleteBeep);
  preventSleepDuringTasksRef.current = useSettingsStore((state) => state.preventSleepDuringTasks);

  const syncAccountState = async (refreshToken: boolean) => {
    try {
      const response = await getAccountWithParams({ refreshToken });
      useCodexStore.getState().setHasAccount(Boolean(response.account));
    } catch (error) {
      console.error('[useCodexEvents] Failed to sync account state:', error);
      useCodexStore.getState().setHasAccount(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void syncAccountState(false);
    // Only re-run when enabled toggles; syncAccountState identity is stable
    // enough for this one-shot initial sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const handleServerNotification = useServerNotificationHandler(
    {
      isCodexThreadActiveRef,
      taskCompleteBeepModeRef,
      preventSleepDuringTasksRef,
    },
    syncAccountState
  );

  // Store actions accessed via getState() are stable function references
  // defined once in the Zustand store initializer.
  const onApproval = useApprovalStore.getState().addApproval;
  const onUserInputRequest = useRequestUserInputStore.getState().addRequest;

  const sharedHandlers = {
    enabled,
    onApproval,
    onUserInputRequest,
    onNotification: handleServerNotification,
  };

  // Only one of these actually registers listeners (both hooks internally
  // gate on `enabled`, but we also gate on transport to avoid opening an
  // unnecessary EventSource on desktop or vice versa).
  useTauriEventListeners({ ...sharedHandlers, enabled: enabled && isDesktopTauri() });
  useSseEventBridge({ ...sharedHandlers, enabled: enabled && !isDesktopTauri() });
}
