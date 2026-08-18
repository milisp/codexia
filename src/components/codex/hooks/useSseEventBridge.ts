import { useEffect, useRef } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { ApprovalRequest, RequestUserInputRequest } from '@/components/codex/stores';
import { openEventStream } from '@/lib/eventStream';

interface SseEventHandlers {
  enabled: boolean;
  onApproval: (payload: ApprovalRequest) => void;
  onUserInputRequest: (payload: RequestUserInputRequest) => void;
  onNotification: (payload: ServerNotification) => void;
}

// Bridges server-sent events (used on non-desktop / web builds) into the
// same handler shape as the Tauri native event listeners.
export function useSseEventBridge({
  enabled,
  onApproval,
  onUserInputRequest,
  onNotification,
}: SseEventHandlers) {
  // Handlers are read through a ref so the effect below depends only on
  // `enabled`. Re-running it on every render would tear down and reopen the
  // event stream, dropping events during the reconnect.
  const handlersRef = useRef({ onApproval, onUserInputRequest, onNotification });
  handlersRef.current = { onApproval, onUserInputRequest, onNotification };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('[useSseEventBridge] Setting up SSE event bridge...');

    // Reconnects carry a `?since=` cursor so events emitted while disconnected
    // are replayed rather than lost. See openEventStream.
    return openEventStream({
      label: '[useSseEventBridge]',
      onEvent: (envelope) => {
        if (!envelope.event) return;

        if (envelope.event === 'fs_change') {
          window.dispatchEvent(new CustomEvent('fs_change', { detail: envelope.payload }));
          return;
        }
        if (envelope.event === 'codex/approval-request') {
          handlersRef.current.onApproval(envelope.payload as ApprovalRequest);
          return;
        }
        if (envelope.event === 'codex/request-user-input') {
          handlersRef.current.onUserInputRequest(envelope.payload as RequestUserInputRequest);
          return;
        }
        if (envelope.event === 'codex:notification') {
          handlersRef.current.onNotification(envelope.payload as ServerNotification);
        }
      },
    });
  }, [enabled]);
}
