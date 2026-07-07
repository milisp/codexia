import { useEffect } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { ApprovalRequest, RequestUserInputRequest } from '@/components/codex/stores';
import { buildUrl } from '@/hooks/runtime';

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
  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('[useSseEventBridge] Setting up SSE event bridge...');

    const handleEnvelope = (data: string) => {
      try {
        const envelope = JSON.parse(data) as { event?: string; payload?: unknown };
        if (!envelope.event) return;

        if (envelope.event === 'fs_change') {
          window.dispatchEvent(new CustomEvent('fs_change', { detail: envelope.payload }));
          return;
        }
        if (envelope.event === 'codex/approval-request') {
          onApproval(envelope.payload as ApprovalRequest);
          return;
        }
        if (envelope.event === 'codex/request-user-input') {
          onUserInputRequest(envelope.payload as RequestUserInputRequest);
          return;
        }
        if (envelope.event === 'codex:notification') {
          onNotification(envelope.payload as ServerNotification);
        }
      } catch (error) {
        console.warn('[useSseEventBridge] Failed to parse SSE message:', error);
      }
    };

    // EventSource auto-reconnects on error/close — no manual retry needed.
    const es = new EventSource(buildUrl('/api/events'));
    es.onmessage = (e) => handleEnvelope(e.data as string);
    es.onerror = () => console.warn('[useSseEventBridge] SSE error — will auto-reconnect');

    return () => {
      es.close();
    };
  }, [enabled, onApproval, onUserInputRequest, onNotification]);
}
