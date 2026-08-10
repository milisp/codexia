import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { buildUrl, isDesktopTauri } from '@/hooks/runtime';
import { useAcpStore } from '@/stores/useAcpStore';
import { applyAcpUpdate } from './applyUpdate';

type AcpEventPayload = {
  connectionId: string;
  agentId: string;
  kind: 'update' | 'permission' | 'stderr' | 'exited' | 'notification';
  update?: Record<string, unknown>;
  requestId?: string;
  toolCall?: Record<string, unknown>;
  options?: Array<{ optionId: string; name: string; kind?: string }>;
  line?: string;
};

/**
 * Bridges backend `acp-message` events (Tauri event / SSE) into the ACP store.
 * Mirrors the CC listener: Tauri events on desktop, `/api/events` SSE elsewhere.
 */
export function useAcpEvents(connectionId: string | null) {
  useEffect(() => {
    if (!connectionId) return;

    const handle = (payload: AcpEventPayload) => {
      if (payload.connectionId !== connectionId) return;
      const store = useAcpStore.getState();

      if (payload.kind === 'exited') {
        store.addEntry({ id: `exit-${Date.now()}`, role: 'error', text: 'Agent process exited.' });
        store.setRunning(false);
        return;
      }

      if (payload.kind === 'permission') {
        const title = (payload.toolCall?.title as string) ?? 'Permission requested';
        store.setPermission({
          requestId: payload.requestId!,
          title,
          options: payload.options ?? [],
        });
        return;
      }

      if (payload.kind !== 'update' || !payload.update) return;

      applyAcpUpdate(payload.update as Record<string, any>);
    };

    if (isDesktopTauri()) {
      const unlisten = listen<AcpEventPayload>('acp-message', (e) => handle(e.payload));
      return () => {
        void unlisten.then((fn) => fn());
      };
    }

    const es = new EventSource(buildUrl('/api/events'));
    es.onmessage = (e) => {
      try {
        const envelope = JSON.parse(e.data as string) as { event?: string; payload?: unknown };
        if (envelope.event === 'acp-message') handle(envelope.payload as AcpEventPayload);
      } catch {}
    };
    return () => es.close();
  }, [connectionId]);
}
