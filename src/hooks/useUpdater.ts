import { invoke, isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import type { Update } from '@tauri-apps/plugin-updater';
import { check } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { isDesktopTauri } from '@/hooks/runtime';

type UpdateStage =
  | 'idle'
  | 'checking'
  | 'downloading'
  /** Downloaded and staged: one click installs and relaunches. */
  | 'ready'
  /** An update exists but Homebrew owns the bundle, so we must not install it. */
  | 'homebrew'
  | 'installing'
  | 'restarting'
  | 'error';

export type UpdateState = {
  stage: UpdateStage;
  version?: string;
  error?: string;
  /** Bytes downloaded so far. */
  downloaded?: number;
  /** Total bytes to download, when the server reports it. */
  contentLength?: number;
};

type UseUpdaterOptions = {
  enabled?: boolean;
  onDebug?: (entry: DebugEntry) => void;
};

type DebugEntry = {
  id: string;
  timestamp: number;
  source: 'error';
  label: string;
  payload: string;
};

// Updater state is process-wide, not per-component: every indicator shows the
// same update, and the download must survive one of them unmounting.
const listeners = new Set<() => void>();
let sharedState: UpdateState = { stage: 'idle' };
let pendingUpdate: Update | null = null;
let checkStarted = false;

const setState = (next: UpdateState | ((prev: UpdateState) => UpdateState)) => {
  sharedState = typeof next === 'function' ? next(sharedState) : next;
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const log = (message: string) => console.info(`[updater] ${message}`);

const isHomebrewInstall = () =>
  isDesktopTauri() ? invoke<boolean>('is_homebrew_install') : Promise.resolve(false);

export function useUpdater({ enabled = true, onDebug }: UseUpdaterOptions = {}) {
  const state = useSyncExternalStore(subscribe, () => sharedState);

  const reportError = useCallback(
    (error: unknown, what: string) => {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      onDebug?.({
        id: `${Date.now()}-client-updater-error`,
        timestamp: Date.now(),
        source: 'error',
        label: 'updater/error',
        payload: message,
      });
      log(`${what} failed: ${message}`);
      setState((prev) => ({ ...prev, stage: 'error', error: message }));
    },
    [onDebug]
  );

  // Check, then stage the download eagerly so the user's click only has to run
  // the install. Homebrew installs stop at the check: brew owns that bundle.
  const checkAndStage = useCallback(async () => {
    let update: Update | null = null;
    try {
      setState({ stage: 'checking' });
      log('checking for updates');
      update = await check();
      if (!update) {
        log('no update available');
        setState({ stage: 'idle' });
        return;
      }
      pendingUpdate = update;
      log(`update available: ${update.version}`);

      if (await isHomebrewInstall()) {
        log('homebrew install: leaving the upgrade to brew');
        setState({ stage: 'homebrew', version: update.version });
        return;
      }

      setState({ stage: 'downloading', version: update.version, downloaded: 0 });
      await update.download((event) => {
        switch (event.event) {
          case 'Started':
            setState((prev) => ({
              ...prev,
              downloaded: 0,
              contentLength: event.data.contentLength,
            }));
            break;
          case 'Progress':
            setState((prev) => ({
              ...prev,
              downloaded: (prev.downloaded ?? 0) + event.data.chunkLength,
            }));
            break;
        }
      });
      log('download staged, waiting for the user to install');
      setState((prev) => ({ ...prev, stage: 'ready' }));
    } catch (error) {
      reportError(error, 'check');
    } finally {
      if (!pendingUpdate) {
        await update?.close();
      }
    }
  }, [reportError]);

  /** Install what was staged and relaunch. Retries the whole flow on error. */
  const startUpdate = useCallback(async () => {
    const update = pendingUpdate;
    if (!update || sharedState.stage === 'error') {
      log('no staged update, checking again');
      await checkAndStage();
      return;
    }
    if (sharedState.stage !== 'ready') {
      return;
    }

    try {
      setState((prev) => ({ ...prev, stage: 'installing', error: undefined }));
      await update.install();
      log('install completed, relaunching');
      setState((prev) => ({ ...prev, stage: 'restarting' }));
      await relaunch();
    } catch (error) {
      reportError(error, 'install');
    }
  }, [checkAndStage, reportError]);

  useEffect(() => {
    if (!enabled || import.meta.env.DEV || !isTauri() || checkStarted) {
      return;
    }
    checkStarted = true;
    void checkAndStage();
  }, [checkAndStage, enabled]);

  return { state, startUpdate };
}
