import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { buildUrl, isDesktopTauri } from '@/hooks/runtime';
import { useCCStore } from '@/stores/cc';
import type { CCMessage, SystemMessage } from '../types/messages';

const CC_LISTENER_READY_EVENT = 'cc-session-listener-ready';
const CC_PERMISSION_LISTENER_READY_EVENT = 'cc-permission-listener-ready';

interface CCListenerOptions {
  /** Disable the listener entirely. */
  disabled?: boolean;
  /**
   * When provided, operates in embedded mode: only messages matching this
   * sessionId are accepted and routed via addMessageToSession instead of
   * the global addMessage.
   */
  sessionId?: string;
}

/**
 * Hook to listen for message stream events from the Tauri backend.
 * Supports both standalone (global active session) and embedded (per-session) modes.
 */
export function useCCSessionListener({ disabled = false, sessionId }: CCListenerOptions = {}) {
  const { activeSessionId, addMessage, addMessageToSession, setSlashCommands } = useCCStore();

  // In embedded mode the target session is the explicit sessionId; otherwise the active one.
  const targetSessionId = sessionId ?? activeSessionId;

  useEffect(() => {
    if (disabled || !targetSessionId) return;
    console.info('[CCSession] Bind message listener', { targetSessionId });

    const handleMessage = (message: CCMessage) => {
      const msgSessionId = (message as { session_id?: string }).session_id;
      if (msgSessionId && msgSessionId !== targetSessionId) return;

      console.info('[CCSession] Received message', message);

      if (sessionId) {
        addMessageToSession(sessionId, message);
      } else {
        if (message.type === 'system' && (message as SystemMessage).subtype === 'init') {
          const cmds = (message as SystemMessage).slash_commands;
          if (Array.isArray(cmds)) setSlashCommands(cmds);
        }
        addMessage(message);
      }
    };

    if (isDesktopTauri()) {
      const unlistenPromise = listen<CCMessage>('cc-message', (event) => {
        handleMessage(event.payload);
      });

      void unlistenPromise.then(() => {
        console.info('[CCSession] Message listener ready (Tauri)', { targetSessionId });
        if (!sessionId) {
          window.dispatchEvent(
            new CustomEvent(CC_LISTENER_READY_EVENT, { detail: { sessionId: targetSessionId } })
          );
        }
      });

      return () => {
        void unlistenPromise.then((fn) => fn());
      };
    }

    // SSE path for non-Tauri (iOS via P2P).
    const sseUrl = buildUrl('/api/events');
    console.info('[CCSession] Opening SSE connection', {
      url: sseUrl,
      targetSessionId,
      isTauri: 'isDesktopTauri=' + isDesktopTauri(),
    });
    const es = new EventSource(sseUrl);
    es.onopen = () => console.info('[CCSession] SSE connected', { url: sseUrl });
    es.onerror = (err) =>
      console.error('[CCSession] SSE error', { url: sseUrl, readyState: es.readyState, err });
    es.onmessage = (e) => {
      try {
        const envelope = JSON.parse(e.data as string) as { event?: string; payload?: unknown };
        if (envelope.event === 'cc-message') {
          handleMessage(envelope.payload as CCMessage);
        }
      } catch {}
    };
    console.info('[CCSession] Message listener ready (SSE)', { targetSessionId });
    if (!sessionId) {
      window.dispatchEvent(
        new CustomEvent(CC_LISTENER_READY_EVENT, { detail: { sessionId: targetSessionId } })
      );
    }

    return () => {
      es.close();
    };
  }, [disabled, targetSessionId, sessionId, addMessage, addMessageToSession, setSlashCommands]);
}

/**
 * Hook to listen for permission requests from the Tauri backend.
 * Supports both standalone (global active session) and embedded (per-session) modes.
 */
export function useCCPermissionListener({ disabled = false, sessionId }: CCListenerOptions = {}) {
  const { activeSessionId, addMessage, addMessageToSession } = useCCStore();

  const targetSessionId = sessionId ?? activeSessionId;

  useEffect(() => {
    if (disabled || !targetSessionId) return;
    console.info('[CCSession] Bind permission listener', { targetSessionId });

    type PermPayload = {
      requestId: string;
      sessionId: string;
      toolName: string;
      toolInput: Record<string, unknown>;
      alwaysAllowTarget?: 'project' | 'session';
    };

    const handlePermission = (payload: PermPayload) => {
      const {
        requestId,
        sessionId: evtSessionId,
        toolName,
        toolInput,
        alwaysAllowTarget,
      } = payload;
      if (evtSessionId !== targetSessionId) {
        if (!sessionId) {
          console.warn('[CCSession] Ignoring permission request for inactive session', {
            targetSessionId,
            requestId,
            evtSessionId,
          });
        }
        return;
      }

      const permissionMessage = {
        type: 'permission_request',
        requestId,
        sessionId: evtSessionId,
        toolName,
        alwaysAllowTarget,
        toolInput,
      } as CCMessage;

      if (sessionId) {
        addMessageToSession(sessionId, permissionMessage);
      } else {
        addMessage(permissionMessage);
      }
    };

    if (isDesktopTauri()) {
      const unlistenPromise = listen<PermPayload>('cc-permission-request', (event) => {
        handlePermission(event.payload);
      });

      void unlistenPromise.then(() => {
        console.info('[CCSession] Permission listener ready (Tauri)', { targetSessionId });
        if (!sessionId) {
          window.dispatchEvent(
            new CustomEvent(CC_PERMISSION_LISTENER_READY_EVENT, {
              detail: { sessionId: targetSessionId },
            })
          );
        }
      });

      return () => {
        void unlistenPromise.then((fn) => fn());
      };
    }

    // SSE path for non-Tauri (iOS via P2P).
    const sseUrl = buildUrl('/api/events');
    console.info('[CCSession] Opening permission SSE connection', { url: sseUrl, targetSessionId });
    const es = new EventSource(sseUrl);
    es.onopen = () => console.info('[CCSession] Permission SSE connected', { url: sseUrl });
    es.onerror = (err) =>
      console.error('[CCSession] Permission SSE error', {
        url: sseUrl,
        readyState: es.readyState,
        err,
      });
    es.onmessage = (e) => {
      try {
        const envelope = JSON.parse(e.data as string) as { event?: string; payload?: unknown };
        if (envelope.event === 'cc-permission-request') {
          handlePermission(envelope.payload as PermPayload);
        }
      } catch {}
    };
    console.info('[CCSession] Permission listener ready (SSE)', { targetSessionId });
    if (!sessionId) {
      window.dispatchEvent(
        new CustomEvent(CC_PERMISSION_LISTENER_READY_EVENT, {
          detail: { sessionId: targetSessionId },
        })
      );
    }

    return () => {
      es.close();
    };
  }, [disabled, targetSessionId, sessionId, addMessage, addMessageToSession]);
}
