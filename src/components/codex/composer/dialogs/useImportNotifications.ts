import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { ExternalAgentConfigImportTypeResult } from '@/bindings/v2';
import { isTauri } from '@/hooks/runtime';

interface ImportNotificationHandlers {
  onProgress: (importId: string, results: ExternalAgentConfigImportTypeResult[]) => void;
  onCompleted: (importId: string, results: ExternalAgentConfigImportTypeResult[]) => void;
}

/**
 * Subscribes to the app-server's `externalAgentConfig/import/*` notifications
 * while `enabled`, using the shared `codex:notification` Tauri event.
 */
export function useImportNotifications(enabled: boolean, handlers: ImportNotificationHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !isTauri()) {
      return;
    }

    const unlistenPromise = listen<ServerNotification>('codex:notification', (event) => {
      const notification = event.payload;
      if (notification.method === 'externalAgentConfig/import/progress') {
        handlersRef.current.onProgress(
          notification.params.importId,
          notification.params.itemTypeResults
        );
      } else if (notification.method === 'externalAgentConfig/import/completed') {
        handlersRef.current.onCompleted(
          notification.params.importId,
          notification.params.itemTypeResults
        );
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [enabled]);
}
