import { ChevronLeft } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNewThread } from '@/components/codex/hooks';
import { useCodexStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useKeyboardInset } from '@/hooks';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { useCCStore, useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';
import { MobileHome } from './MobileHome';

const AgentView = lazy(() => import('@/components/agent/AgentView'));

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

/**
 * Two full-screen pages instead of the desktop's sidebar + panels layout.
 *
 * A phone has room for one thing at a time: the home list, or a conversation.
 * Opening or starting a session pushes the chat over the top of home, and Back
 * returns — the session itself is left intact so returning to it is instant.
 */
function MobileShellContent() {
  const [screen, setScreen] = useState<'home' | 'session'>('home');

  const { cwd, setCwd } = useWorkspaceStore();
  const { selectedAgent, setSelectedAgent } = useAgentSettingsStore();
  const { setView, setActiveSidebarTab } = useLayoutStore();
  const { currentThreadId } = useCodexStore();
  const { activeSessionId } = useCCStore();
  const { active: acpActive, connectionId: acpConnectionId } = useAcpStore();
  const { handleNewThread } = useNewThread();
  const { handleNewSession } = useCCSessionManager();

  const activeId = acpActive
    ? acpConnectionId
    : selectedAgent === 'cc'
      ? activeSessionId
      : currentThreadId;

  // Selecting a row in the list only sets the active id — the lists have no
  // callback of their own — so navigation follows that id rather than a click.
  useEffect(() => {
    if (activeId) setScreen('session');
  }, [activeId]);

  const startInProject = useCallback(
    async (directory: string) => {
      setView('agent');
      setScreen('session');
      if (directory !== cwd) setCwd(directory);

      if (acpActive) {
        // `restart` tears down the connection so the composer reconnects in the
        // new workspace.
        useAcpStore.getState().restart();
        return;
      }
      if (selectedAgent === 'cc') {
        setSelectedAgent('cc');
        setActiveSidebarTab('cc');
        await handleNewSession();
        focusCCInput();
        return;
      }
      await handleNewThread();
    },
    [
      acpActive,
      cwd,
      handleNewSession,
      handleNewThread,
      selectedAgent,
      setActiveSidebarTab,
      setCwd,
      setSelectedAgent,
      setView,
    ]
  );

  if (screen === 'home') {
    return (
      <MobileHome
        onNewInProject={(directory) => void startInProject(directory)}
        onNewSession={() => cwd && void startInProject(cwd)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-1">
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setScreen('home')}>
          <ChevronLeft className="size-5" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm">{getFilename(cwd)}</span>
      </header>
      <div className="min-h-0 flex-1">
        <Suspense fallback={null}>
          <AgentView />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * `SidebarProvider` has no sidebar to drive here, but shared components below
 * still read its context, so the provider stays even on a phone.
 */
export function MobileShell() {
  useKeyboardInset();

  return (
    <SidebarProvider>
      {/* `viewport-fit=cover` extends the web view under the status bar and the
          home indicator, so the shell owns the safe-area padding. The keyboard
          covers the viewport rather than shrinking it, so pad by its height too
          to lift the composer above it. */}
      <div
        className="flex h-svh min-h-0 w-full min-w-0 flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'var(--keyboard-inset, 0px)',
        }}
      >
        <MobileShellContent />
      </div>
    </SidebarProvider>
  );
}
