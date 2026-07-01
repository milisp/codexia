import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import './App.css';

import { useCodexEvents } from '@/components/codex/hooks';
import { useAppDeepLink } from '@/hooks/useAppDeepLink';
import { useUrlParamThread } from '@/hooks/useUrlParamThread';
import { AppLayout } from '@/components/layout';
import { isTauri } from '@/hooks/runtime';
import { HistoryProjectsDialog } from '@/components/project-selector';
import { AnalyticsConsentDialog } from '@/components/settings/AnalyticsConsentDialog';
import { QuitDialog } from '@/components/dialogs';
import { initializeCodexAsync } from '@/services/tauri';
import type { InitializeResponse } from './bindings';
import { loadSettings, initSettingsSync } from '@/lib/settings';
import { StoreErrorBoundary } from '@/components/StoreErrorBoundary';

function AppShell() {
  const [quitDialogOpen, setQuitDialogOpen] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  // True once codex backend signals it is ready; non-Tauri skips init entirely.
  const [codexReady, setCodexReady] = useState(!isTauri());

  useEffect(() => {
    loadSettings().finally(() => setSettingsReady(true));
  }, []);
  useEffect(() => {
    return initSettingsSync();
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    initializeCodexAsync().catch((error) => {
      console.warn('Failed to initialize codex asynchronously', error);
    });

    // Listen for codex initialized event
    const unlisten = listen<InitializeResponse>('codex:initialized', (event) => {
      console.log('[App] Codex initialized, userAgent:', event.payload.userAgent);
      setCodexReady(true);
    });

    // Show quit confirmation when Cmd+Q is pressed
    const unlistenQuit = listen('quit-requested', () => {
      setQuitDialogOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenQuit.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to codex events only after backend is initialized
  useCodexEvents(codexReady);

  // Web-mode deep link: ?agent=codex&thread=<id>&cwd=<path> (or agent=cc&session=<id>)
  useUrlParamThread(codexReady);

  // Wait for settings load before rendering
  if (!settingsReady) return null;

  return (
    <>
      <AppLayout />
      <HistoryProjectsDialog />
      <AnalyticsConsentDialog />
      <QuitDialog open={quitDialogOpen} onOpenChange={setQuitDialogOpen} />
    </>
  );
}

export default function App() {
  useAppDeepLink();

  return (
    <StoreErrorBoundary>
      <AppShell />
    </StoreErrorBoundary>
  );
}