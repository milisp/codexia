import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { CodexParseErrorEvent, CodexStderrEvent } from '@/components/codex/CodexInternalEvent';
import type { ApprovalRequest, RequestUserInputRequest } from '@/components/codex/stores';

interface TauriEventHandlers {
  enabled: boolean;
  onApproval: (payload: ApprovalRequest) => void;
  onUserInputRequest: (payload: RequestUserInputRequest) => void;
  onNotification: (payload: ServerNotification) => void;
}

// Registers Tauri native event listeners (approval requests, user input
// requests, server notifications, stderr, parse errors) and cleans them
// up on unmount.
export function useTauriEventListeners({
  enabled,
  onApproval,
  onUserInputRequest,
  onNotification,
}: TauriEventHandlers) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('[useTauriEventListeners] Setting up Tauri event listeners...');

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
      onApproval(event.payload);
    });

    void registerListener<RequestUserInputRequest>('codex/request-user-input', (event) => {
      onUserInputRequest(event.payload);
    });

    void registerListener<ServerNotification>('codex:notification', (event) => {
      onNotification(event.payload);
    });

    void registerListener<CodexStderrEvent>('codex:stderr', (event) => {
      console.error('[useTauriEventListeners] codex stderr:', event.payload.message);
    });

    void registerListener<CodexParseErrorEvent>('codex:parseError', (event) => {
      console.error(
        '[useTauriEventListeners] codex parseError:',
        event.payload.error,
        event.payload.raw
      );
    });

    return () => {
      cancelled = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [enabled, onApproval, onUserInputRequest, onNotification]);
}
