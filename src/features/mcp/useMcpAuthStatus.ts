import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { McpAuthStatus } from '@/bindings/v2';
import { isTauri } from '@/hooks/runtime';
import { listMcpServerStatus } from '@/services';

/**
 * Fetches MCP server auth statuses from the codex app-server and keeps them
 * fresh when the server pushes status / oauth notifications.
 */
export function useMcpAuthStatus() {
  const [authStatuses, setAuthStatuses] = useState<Record<string, McpAuthStatus>>({});

  const refresh = useCallback(async () => {
    try {
      const response = await listMcpServerStatus({
        cursor: null,
        limit: null,
        detail: 'toolsAndAuthOnly',
        threadId: null,
      });
      const next: Record<string, McpAuthStatus> = {};
      for (const status of response.data) {
        next[status.name] = status.authStatus;
      }
      setAuthStatuses(next);
    } catch (error) {
      // The codex backend may be unavailable; auth badges are optional.
      console.warn('[useMcpAuthStatus] failed to list mcp server status:', error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    const unlistenPromise = listen<ServerNotification>('codex:notification', (event) => {
      const { method } = event.payload;
      if (
        method === 'mcpServer/oauthLogin/completed' ||
        method === 'mcpServer/startupStatus/updated'
      ) {
        refresh();
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [refresh]);

  return { authStatuses, refreshAuthStatuses: refresh };
}
