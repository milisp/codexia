import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef } from 'react';
import { isDesktopTauri } from '@/hooks/runtime';
import { unwatchDirectory, watchDirectory } from '@/services/tauri/filesystem';
import { isGitRepo } from '@/services/tauri/git';

/**
 * Hook to watch cwd for any fs changes and trigger Git status refresh.
 * Relies entirely on the Rust fs watcher (notify + debouncer) — no polling fallback.
 */
export function useGitWatch(cwd: string | null, onRefresh: () => void, enabled = true) {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced refresh to avoid too many calls
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      onRefresh();
    }, 300);
  }, [onRefresh]);

  useEffect(() => {
    if (!cwd || !enabled) return;

    let cancelled = false;

    // Set up the Rust fs watcher on cwd and listen for change events.
    // watcher.rs is ref-counted, so watch/unwatch here is safe even if other callers also watch cwd.
    const setupWatcher = async () => {
      try {
        await watchDirectory(cwd);
        if (isDesktopTauri()) {
          const unlisten = await listen<{ path: string; kind: string }>('fs_change', () => {
            debouncedRefresh();
          });
          unlistenRef.current = unlisten;
          return;
        }

        const onWsEvent = () => debouncedRefresh();
        window.addEventListener('fs_change', onWsEvent as EventListener);
        unlistenRef.current = () => {
          window.removeEventListener('fs_change', onWsEvent as EventListener);
        };
      } catch (error) {
        console.warn('Failed to subscribe to fs_change:', error);
      }
    };

    // Only set up the watcher if cwd is actually a git repo.
    const initialize = async () => {
      if (!(await isGitRepo(cwd))) return;
      if (cancelled) return;
      void setupWatcher();
    };

    void initialize();

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      void unwatchDirectory(cwd).catch(() => {});
    };
  }, [cwd, enabled, debouncedRefresh]);
}
