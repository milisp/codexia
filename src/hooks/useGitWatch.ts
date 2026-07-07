import { useCallback, useEffect, useRef } from 'react';
import { useDirWatch, type FsChangeEvent } from '@/hooks/useDirWatch';
import { isGitRepo } from '@/services/tauri/git';

/**
 * Hook to watch cwd for any fs changes and trigger Git status refresh.
 * Relies entirely on the Rust fs watcher (notify + debouncer) — no polling fallback.
 */
export function useGitWatch(cwd: string | null, onRefresh: () => void, enabled = true) {
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRepoRef = useRef(false);

  // Debounced refresh to avoid too many calls
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      onRefresh();
    }, 300);
  }, [onRefresh]);

  // Only watch if cwd is actually a git repo.
  const watchEnabled = enabled && !!cwd;

  useEffect(() => {
    let cancelled = false;
    isRepoRef.current = false;
    if (!cwd || !enabled) return;

    const check = async () => {
      const result = await isGitRepo(cwd);
      if (!cancelled) isRepoRef.current = result;
    };
    void check();

    return () => {
      cancelled = true;
    };
  }, [cwd, enabled]);

  const handleChange = useCallback(
    (_event: FsChangeEvent) => {
      if (!isRepoRef.current) return;
      debouncedRefresh();
    },
    [debouncedRefresh]
  );

  useDirWatch(cwd, handleChange, watchEnabled);

  // Clear pending debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);
}
