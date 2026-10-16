import { useEffect } from 'react';
import { isPhone } from '@/hooks/runtime';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useServerProjectsStore } from './useServerProjectsStore';

const RETRY_MS = 4000;
const MAX_RETRIES = 8;

/**
 * Keeps the cwd project list backed by app-server projects: loads them (the
 * app-server may still be starting, so failures are retried), imports local
 * projects the server lacks once per machine, and creates a project for each
 * folder added afterwards. A phone only mirrors its desktop and never imports.
 */
export function useServerProjectsSync(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const { refresh, importPaths } = useServerProjectsStore.getState();

    const start = async () => {
      await refresh();
      if (cancelled) return;
      const { status } = useServerProjectsStore.getState();
      if (status === 'ready') {
        if (!isPhone()) await importPaths(useWorkspaceStore.getState().projects);
        return;
      }
      if (status === 'error' && retries < MAX_RETRIES) {
        retries += 1;
        timer = setTimeout(() => void start(), RETRY_MS);
      }
    };
    void start();

    // Folders added through any picker become projects.
    const unsubscribe = useWorkspaceStore.subscribe((state, prev) => {
      if (isPhone() || state.projects === prev.projects) return;
      if (useServerProjectsStore.getState().status !== 'ready') return;
      const added = state.projects.filter((path) => !prev.projects.includes(path));
      if (added.length > 0) {
        void useServerProjectsStore.getState().importPaths(added, { interactive: true });
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);
}
