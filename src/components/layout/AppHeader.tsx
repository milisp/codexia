import { History } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { codexService } from '@/services/codexService';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
import { useCodexStore, useCurrentThread } from '@/components/codex/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { RightPanelHeader } from './RightPanelHeader';
import { useCCStore } from '@/stores/cc';
import { useTrafficLightConfig } from '@/hooks';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { UpdateButton } from '../features/UpdateButton';

export function AppHeader() {
  const { setView, view } = useLayoutStore();
  const { open: isSidebarOpen, openMobile, isMobile } = useSidebar();
  const { setHistoryMode, selectedAgent } = useWorkspaceStore();
  const { cards } = useAgentCenterStore();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  // Show trigger when sidebar is closed; on mobile the Sheet is transient so always show
  const showTrigger = isMobile ? !openMobile : !isSidebarOpen;

  const { activeSessionId } = useCCStore();
  const { currentThreadId, activeThreadIds } = useCodexStore();
  const currentThread = useCurrentThread();
  const isHistoryView = view === 'history';

  const activeAgentId = selectedAgent === 'codex' ? currentThreadId : activeSessionId;

  const hasCurrentCard = useMemo(
    () => (activeAgentId ? cards.some((c) => c.kind === selectedAgent && c.id === activeAgentId) : false),
    [activeAgentId, cards, selectedAgent],
  );

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
        {view === 'agent' && !hasCurrentCard && (
          <span className="text-xs text-muted-foreground/60 pl-2">
            New {selectedAgent === 'codex' ? 'thread' : 'session'}
          </span>
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
      <RightPanelHeader />
    </div>
  );
}
