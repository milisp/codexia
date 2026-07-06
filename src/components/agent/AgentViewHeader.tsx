import { History, LayoutGrid, List, PanelRight, Square, SquareTerminal } from 'lucide-react';
import { useCallback } from 'react';
import { useCodexStore, useCurrentThread } from '@/components/codex/stores';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { GitActions } from '@/components/features/git';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useTrafficLightConfig } from '@/hooks';
import { codexService } from '@/services/codexService';
import { useCCStore, useLayoutStore } from '@/stores';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import type { AgentCardsViewMode } from '@/stores/useAgentCenterStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { UpdateButton } from '../features/UpdateButton';

const CARDS_VIEW_MODES: { mode: AgentCardsViewMode; icon: typeof LayoutGrid; title: string }[] = [
  { mode: 'grid', icon: LayoutGrid, title: 'Grid view' },
  { mode: 'list', icon: List, title: 'List view' },
  { mode: 'single', icon: Square, title: 'Single view' },
];

export function AgentViewHeader() {
  const { setView, view, isRightPanelOpen, toggleRightPanel, isTerminalOpen, setIsTerminalOpen } =
    useLayoutStore();
  const { cardsViewMode, setCardsViewMode } = useAgentCenterStore();
  const { open: isSidebarOpen, openMobile, isMobile } = useSidebar();
  const { setHistoryMode, selectedAgent } = useWorkspaceStore();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  const { activeThreadIds, currentThreadId } = useCodexStore();
  const { activeSessionId } = useCCStore();
  // Show trigger when sidebar is closed; on mobile the Sheet is transient so always show
  const showTrigger = isMobile ? !openMobile : !isSidebarOpen;
  const hasActiveSession = currentThreadId || activeSessionId;

  const currentThread = useCurrentThread();
  const isHistoryView = view === 'history';

  const handleToggleHistoryMode = useCallback(async () => {
    const nextMode = !isHistoryView;
    setHistoryMode(nextMode);
    setView(nextMode ? 'history' : 'agent');

    if (!nextMode) {
      const targetThreadId = currentThreadId ?? currentThread?.id ?? null;
      if (targetThreadId && !activeThreadIds.includes(targetThreadId)) {
        await codexService.setCurrentThread(targetThreadId);
      }
    }
  }, [isHistoryView, setHistoryMode, setView, currentThreadId, currentThread, activeThreadIds]);

  return (
    <div
      className="flex items-center justify-between h-11 border-b border-white/10 bg-sidebar/20"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 items-center gap-2">
        {showTrigger && (
          <div className={`flex gap-2 items-center ${needsTrafficLightOffset ? 'pl-20' : 'pl-2'}`}>
            <SidebarTrigger />
            <NewAgentButton />
            <UpdateButton />
          </div>
        )}
        {selectedAgent === 'codex' &&
          currentThreadId &&
          (view === 'agent' || view === 'history') && (
            <Button
              variant={isHistoryView ? 'secondary' : 'ghost'}
              size="icon"
              onClick={handleToggleHistoryMode}
              title={isHistoryView ? 'Exit history mode' : 'Enter history mode'}
            >
              <History />
            </Button>
          )}
      </div>
      <span className="flex items-center gap-1 pr-2">
        <span className="flex items-center gap-0.5 border rounded-md p-0.5">
          {CARDS_VIEW_MODES.map(({ mode, icon: Icon, title }) => (
            <Button
              key={mode}
              variant={cardsViewMode === mode ? 'secondary' : 'ghost'}
              size="icon"
              className="h-6 w-6"
              onClick={() => setCardsViewMode(mode)}
              title={title}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </span>
        {!isRightPanelOpen && (
          <>
            {hasActiveSession && <GitActions />}
            <Button
              variant={isTerminalOpen ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setIsTerminalOpen(!isTerminalOpen)}
              title={isTerminalOpen ? 'Hide terminal' : 'Show terminal'}
            >
              <SquareTerminal className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleRightPanel} title="Hide right panel">
              <PanelRight className="size-4" />
            </Button>
          </>
        )}
      </span>
    </div>
  );
}
