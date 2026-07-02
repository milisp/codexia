import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import type { Update } from '@tauri-apps/plugin-updater';
import { check } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useRef, useState } from 'react';

type UpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'restarting'
  | 'error';

export type UpdateState = {
  stage: UpdateStage;
  version?: string;
  error?: string;
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

export function useUpdater({ enabled = true, onDebug }: UseUpdaterOptions) {
  const [state, setState] = useState<UpdateState>({ stage: 'idle' });
  const updateRef = useRef<Update | null>(null);
  const log = useCallback((message: string) => {
    console.info(`[updater] ${message}`);
  }, []);

  const resetToIdle = useCallback(async () => {
    const update = updateRef.current;
    updateRef.current = null;
    setState({ stage: 'idle' });
    log('reset to idle');
    await update?.close();
  }, [log]);

  const checkForUpdates = useCallback(async () => {
    if (import.meta.env.DEV) {
      log('skip check: dev mode');
      setState({ stage: 'idle' });
      return;
    }
    if (!isTauri()) {
      log('skip check: not running in tauri');
      setState({ stage: 'idle' });
      return;
    }

    let update: Awaited<ReturnType<typeof check>> | null = null;
    try {
      setState({ stage: 'checking' });
      log('checking for updates');
      update = await check();
      if (!update) {
        log('no update available');
        setState({ stage: 'idle' });
        return;
      }

      updateRef.current = update;
      log(`update available: ${update.version}`);
      setState({
        stage: 'available',
        version: update.version,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      onDebug?.({
        id: `${Date.now()}-client-updater-error`,
        timestamp: Date.now(),
        source: 'error',
        label: 'updater/error',
        payload: message,
      });
      log(`check failed: ${message}`);
      setState({ stage: 'error', error: message });
    } finally {
      if (!updateRef.current) {
        await update?.close();
      }
    }
  }, [log, onDebug]);

  const startUpdate = useCallback(async () => {
    if (!isTauri()) {
      log('skip update: not running in tauri');
      return;
    }

    const update = updateRef.current;
    if (!update) {
      log('start update requested without cached update, checking first');
      await checkForUpdates();
      return;
    }

    log('starting download and install');
    setState((prev) => ({
      ...prev,
      stage: 'downloading',
      error: undefined,
    }));

    try {
      setState((prev) => ({
        ...prev,
        stage: 'installing',
      }));
      await update.downloadAndInstall();
      log('download and install completed, relaunching');

      setState((prev) => ({
        ...prev,
        stage: 'restarting',
      }));
      await relaunch();
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      onDebug?.({
        id: `${Date.now()}-client-updater-error`,
        timestamp: Date.now(),
        source: 'error',
        label: 'updater/error',
        payload: message,
      });
      log(`install failed: ${message}`);
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: message,
      }));
    }
  }, [checkForUpdates, log, onDebug]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (import.meta.env.DEV) {
      return;
    }
    if (!isTauri()) {
      return;
    }
    log('updater effect mounted, triggering initial check');
    void checkForUpdates();
  }, [checkForUpdates, enabled, log]);

  return {
    state,
    hasUpdate: state.stage === 'available',
    startUpdate,
    dismiss: resetToIdle,
  };
}
