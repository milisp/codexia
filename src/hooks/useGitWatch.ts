import { useEffect, useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { startWatchFile, stopWatchFile } from '@/services/tauri/filesystem';
import { isGitRepo } from '@/services/tauri/git';
import { isDesktopTauri } from '@/hooks/runtime';

/**
 * Hook to watch .git/index file changes and trigger Git status refresh
 */
export function useGitWatch(cwd: string | null, onRefresh: () => void, enabled = true) {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounced refresh to avoid too many calls
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      onRefresh();
    }, 300); // 300ms debounce
  }, [onRefresh]);

  useEffect(() => {
    if (!cwd || !enabled) return;

    let cancelled = false;
    const gitIndexPath = `${cwd}/.git/index`;
    const normalizedGitIndexPath = gitIndexPath.replace(/\\/g, '/');

    const isGitIndexChange = (path: string) => {
      const normalizedPath = path.replace(/\\/g, '/');
      return (
        normalizedPath === normalizedGitIndexPath || normalizedPath.endsWith('/.git/index')
      );
    };

    // Listen to backend fs watcher events and trigger refresh on .git/index file changes.
    const setupWatcher = async () => {
      try {
        await startWatchFile(gitIndexPath);

        if (isDesktopTauri()) {
          const unlisten = await listen<{ path: string; kind: string }>('fs_change', (event) => {
            if (isGitIndexChange(event.payload.path)) {
              debouncedRefresh();
            }
          });
          unlistenRef.current = unlisten;
          return;
        }

        const onWsEvent = (event: Event) => {
          const changedPath = (event as CustomEvent<{ path?: string }>).detail?.path;
          if (changedPath && isGitIndexChange(changedPath)) {
            debouncedRefresh();
          }
        };
        window.addEventListener('fs_change', onWsEvent as EventListener);
        unlistenRef.current = () => {
          window.removeEventListener('fs_change', onWsEvent as EventListener);
        };
      } catch (error) {
        console.warn('Failed to watch .git/index:', error);
      }
    };

    // Preflight: if cwd isn't a git repo, skip polling and watcher entirely.
    // Otherwise consumers' refresh callbacks loop on errors every 2.5s.
    const initialize = async () => {
      if (!(await isGitRepo(cwd))) return;
      if (cancelled) return;
      // Keep a low-frequency fallback for platforms where file events may be missed.
      pollingRef.current = setInterval(() => {
        debouncedRefresh();
      }, 2500);
      void setupWatcher();
    };

    void initialize();

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      void stopWatchFile(gitIndexPath).catch(() => { });
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [cwd, enabled, debouncedRefresh]);
}
