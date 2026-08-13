import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import './App.css';

import { useCodexEvents } from '@/components/codex/hooks';
import { QuitDialog } from '@/components/dialogs';
import { AppLayout } from '@/components/layout';
import { PairingView } from '@/components/pairing/PairingView';
import { AnalyticsConsentDialog } from '@/components/settings/AnalyticsConsentDialog';
import { HistoryProjectsDialog } from '@/features/ProjectSelector';
import { isDesktopTauri, isPhone } from '@/hooks/runtime';
import { useAppDeepLink } from '@/hooks/useAppDeepLink';
import { useUrlParamThread } from '@/hooks/useUrlParamThread';
import { hasActiveWork } from '@/lib/hasActiveWork';
import { initSettingsSync, loadSettings } from '@/lib/settings';
import { initializeCodexAsync } from '@/services/apiAdapt';
import { usePairingStore } from '@/stores/usePairingStore';
import type { InitializeResponse } from './bindings';

function AppShell() {
  const [quitDialogOpen, setQuitDialogOpen] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  // True once codex backend signals it is ready; only desktop Tauri has a
  // local backend to initialize — mobile and web talk to a remote one.
  const [codexReady, setCodexReady] = useState(!isDesktopTauri());

  useEffect(() => {
    loadSettings().finally(() => setSettingsReady(true));
  }, []);
  useEffect(() => {
    return initSettingsSync();
  }, []);

  useEffect(() => {
    if (!isDesktopTauri()) {
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

    // Cmd+Q quits immediately when nothing is running, otherwise confirms first
    const unlistenQuit = listen('quit-requested', () => {
      void hasActiveWork().then((active) => {
        if (active) {
          setQuitDialogOpen(true);
        } else {
          void invoke('quit_app');
        }
      });
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

  const isPaired = usePairingStore((s) => s.desktop !== null);

  // A phone has no local backend, so it cannot do anything until it is paired.
  if (isPhone() && !isPaired) return <PairingView />;

  return <AppShell />;
}
