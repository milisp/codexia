import {
  Circle,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { codexService } from '@/services/codexService';
import { ProjectSelector } from '@/components/project-selector';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
import { useCodexStore, useCurrentThread } from '@/stores/codex';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { RightPanelHeader } from './RightPanelHeader';
import { useCCStore } from '@/stores/cc';
import { isTauri } from '@/hooks/runtime';
import { useTrafficLightConfig } from '@/hooks';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

export function AppHeader() {
  const { setView, view } = useLayoutStore();
  const { open: isSidebarOpen, openMobile, isMobile } = useSidebar();
  const { setHistoryMode, selectedAgent } = useWorkspaceStore();
  const { cards } = useAgentCenterStore();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  // Show trigger when sidebar is closed; on mobile the Sheet is transient so always show
  const showTrigger = isMobile ? !openMobile : !isSidebarOpen;

  const { isConnected, activeSessionId } = useCCStore();
  const { currentThreadId, activeThreadIds } = useCodexStore();
  const currentThread = useCurrentThread();
  const isHistoryView = view === 'history';
  const activeAgentId = selectedAgent === 'codex' ? currentThreadId : activeSessionId;
  const hasCurrentCard = activeAgentId
    ? cards.some((c) => c.kind === selectedAgent && c.id === activeAgentId)
    : false;

  const handleToggleHistoryMode = async () => {
    const nextMode = !isHistoryView;
    setHistoryMode(nextMode);
    setView(nextMode ? 'history' : 'agent');

    if (!nextMode) {
      const targetThreadId = currentThreadId ?? currentThread?.id ?? null;
      if (targetThreadId && !activeThreadIds.includes(targetThreadId)) {
        await codexService.setCurrentThread(targetThreadId);
      }
    }
  };

  return (
    <div
      className="flex items-center justify-between h-11 border-b border-white/10 bg-sidebar/20"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 items-center gap-2">
        {showTrigger && (
          <div className={`flex items-center ${needsTrafficLightOffset ? 'pl-20' : 'pl-2'}`}>
            <SidebarTrigger />
            <NewAgentButton />
          </div>
        )}
        {view === 'agent' && !hasCurrentCard && (
          <span className="text-xs text-muted-foreground/60">
            New {selectedAgent === 'codex' ? 'thread' : 'session'}
          </span>
        )}
        {view === 'agent' && selectedAgent === 'cc' && (
          <span
            title={isConnected ? 'Connected' : 'Ready'}
            aria-label={isConnected ? 'Connected' : 'Ready'}
          >
            <Circle
              className={`size-3 ${isConnected
                ? 'fill-emerald-500 text-emerald-500'
                : 'fill-transparent text-emerald-500/80'
                }`}
            />
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
        {!isTauri() && (
          <ProjectSelector forcedMode="browse" triggerMode="project-name" />
        )}
      </div>
      <RightPanelHeader />
    </div>
  );
}
