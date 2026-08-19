import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { CodexParseErrorEvent, CodexStderrEvent } from '@/components/codex/CodexInternalEvent';
import type {
  ApprovalRequest,
  ElicitationRequest,
  PermissionsRequest,
  RequestUserInputRequest,
} from '@/components/codex/stores';

interface TauriEventHandlers {
  enabled: boolean;
  onApproval: (payload: ApprovalRequest) => void;
  onUserInputRequest: (payload: RequestUserInputRequest) => void;
  onElicitationRequest: (payload: ElicitationRequest) => void;
  onPermissionsRequest: (payload: PermissionsRequest) => void;
  onNotification: (payload: ServerNotification) => void;
}

// Registers Tauri native event listeners (approval requests, user input
// requests, server notifications, stderr, parse errors) and cleans them
// up on unmount.
export function useTauriEventListeners({
  enabled,
  onApproval,
  onUserInputRequest,
  onElicitationRequest,
  onPermissionsRequest,
  onNotification,
}: TauriEventHandlers) {
  // Handlers are read through a ref so the effect below depends only on
  // `enabled`. Re-running it on every render would unlisten and re-register
  // asynchronously, dropping every event emitted during the gap.
  const handlersRef = useRef({
    onApproval,
    onUserInputRequest,
    onElicitationRequest,
    onPermissionsRequest,
    onNotification,
  });
  handlersRef.current = {
    onApproval,
    onUserInputRequest,
    onElicitationRequest,
    onPermissionsRequest,
    onNotification,
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('[useTauriEventListeners] Setting up Tauri event listeners...');

    // Collect resolved unlisten functions synchronously as promises settle.
    // Using a cancelled flag ensures we don't register listeners after cleanup.
    let cancelled = false;
    const unlisteners: (() => void)[] = [];

    const registerListener = async <T>(event: string, handler: (event: { payload: T }) => void) => {
      const unlisten = await listen<T>(event, handler);
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    };

    void registerListener<ApprovalRequest>('codex/approval-request', (event) => {
      handlersRef.current.onApproval(event.payload);
    });

    void registerListener<RequestUserInputRequest>('codex/request-user-input', (event) => {
      handlersRef.current.onUserInputRequest(event.payload);
    });

    void registerListener<ElicitationRequest>('codex/elicitation-request', (event) => {
      handlersRef.current.onElicitationRequest(event.payload);
    });

    void registerListener<PermissionsRequest>('codex/permissions-request', (event) => {
      handlersRef.current.onPermissionsRequest(event.payload);
    });

    void registerListener<ServerNotification>('codex:notification', (event) => {
      handlersRef.current.onNotification(event.payload);
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
      for (const unlisten of unlisteners) unlisten();
    };
  }, [enabled]);
}
