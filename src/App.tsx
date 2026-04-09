import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import './App.css';
import { useCodexEvents } from '@/hooks/codex';
import { useDeepLink } from '@/hooks/useDeepLink';
import { AppLayout } from '@/components/layout';
import { isTauri, getIsPhone } from '@/hooks/runtime';
const LoginView = lazy(() => import('@/views/LoginView'));
import { HistoryProjectsDialog } from '@/components/project-selector';
import { AnalyticsConsentDialog } from '@/components/settings/AnalyticsConsentDialog';
import { initializeCodexAsync } from '@/services/tauri';
import type { InitializeResponse } from './bindings';
import { loadSettings, initSettingsSync, loadRemoteSettings } from '@/lib/settings';
import { StoreErrorBoundary } from '@/components/StoreErrorBoundary';
import { useP2PConnection } from '@/hooks/useP2PConnection';
import { toast } from 'sonner';
import { useTunnel } from '@/hooks/useTunnel'
import { useSettingsStore } from '@/stores/settings/useSettingsStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  // Mobile: auto-connect to desktop via Quinn P2P
  const { state: p2pState, error: p2pError, retry: p2pRetry } = useP2PConnection();

  // Toast on P2P state changes so the user always sees what's happening
  const prevP2PState = useRef(p2pState);
  useEffect(() => {
    if (!isPhone || prevP2PState.current === p2pState) return;
    prevP2PState.current = p2pState;

    if (p2pState === 'connected') {
      void loadRemoteSettings();
      toast.success('Connected to desktop');
    } else if (p2pState === 'offline') {
      toast.error('Desktop offline', {
        description: p2pError ?? 'Open Codexia on your Mac and enable P2P',
        action: { label: 'Retry', onClick: p2pRetry },
        duration: Infinity,
      });
    } else if (p2pState === 'error') {
      toast.error('P2P connection failed', {
        description: p2pError ?? 'Unknown error',
        action: { label: 'Retry', onClick: p2pRetry },
        duration: Infinity,
      });
    }
  }, [p2pState, p2pError, p2pRetry, isPhone]);

  // Desktop: auto-start P2P server on login only if user has opted in
  const { start: p2pStart, status: p2pStatus } = useTunnel();
  const p2pAutoStart = useSettingsStore((s) => s.p2pAutoStart);
  useEffect(() => {
    if (!isTauri() || isPhone !== false || p2pStatus.connected || !p2pAutoStart) return;
    void p2pStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone, p2pAutoStart]);

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

  // Wait for platform detection and settings load before rendering
  if (isPhone === null || !settingsReady) return null;

  // Mobile: no session → show login so the user can authenticate first
  if (isPhone === true && p2pState === 'idle') {
    return <Suspense fallback={null}><LoginView /></Suspense>;
  }

  return (
    <>
      <AppLayout />
      <HistoryProjectsDialog />
      <AnalyticsConsentDialog />
      <AlertDialog open={quitDialogOpen} onOpenChange={setQuitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Codexia?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to quit? All running agents will be stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => invoke('quit_app')}>Quit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
