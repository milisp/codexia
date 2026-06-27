import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { useCodexEvents } from '@/components/codex/hooks';
import { useDeepLink } from '@/hooks/useDeepLink';
import { useUrlParamThread } from '@/hooks/useUrlParamThread';
import { AppLayout } from '@/components/layout';
import { isTauri, getIsPhone } from '@/hooks/runtime';
import { HistoryProjectsDialog } from '@/components/project-selector';
import { AnalyticsConsentDialog } from '@/components/settings/AnalyticsConsentDialog';
import { initializeCodexAsync } from '@/services/tauri';
import type { InitializeResponse } from './bindings';
import { loadSettings, initSettingsSync } from '@/lib/settings';
import { StoreErrorBoundary } from '@/components/StoreErrorBoundary';
import { QuitDialog } from '@/components/dialogs';

function AppShell() {
  const [quitDialogOpen, setQuitDialogOpen] = useState(false);
  const [isPhone, setIsPhone] = useState<boolean | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  // True once codex backend signals it is ready; non-Tauri skips init entirely.
  const [codexReady, setCodexReady] = useState(!isTauri());

  useEffect(() => { void getIsPhone().then(setIsPhone); }, []);

  useEffect(() => {
    void loadSettings().finally(() => setSettingsReady(true));
    return initSettingsSync();
  }, []);

  useEffect(() => {
    if (!isTauri() || isPhone !== false) {
      return;
    }

    void initializeCodexAsync().catch((error) => {
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
  }, [isPhone]);

  // Listen to codex events only after backend is initialized
  useCodexEvents(codexReady);

  // Web-mode deep link: ?agent=codex&thread=<id>&cwd=<path> (or agent=cc&session=<id>)
  useUrlParamThread(codexReady);

  // Wait for platform detection and settings load before rendering
  if (isPhone === null || !settingsReady) return null;

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
  useDeepLink(isTauri());

  return (
    <StoreErrorBoundary>
      <AppShell />
    </StoreErrorBoundary>
  );
}
