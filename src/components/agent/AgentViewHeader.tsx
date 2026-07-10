import { LayoutGrid, List, PanelRight, Square, SquareTerminal } from 'lucide-react';
import { useCodexStore } from '@/components/codex/stores';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { GitActions } from '@/components/features/git';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useTrafficLightConfig } from '@/hooks';
import { useCCStore, useLayoutStore } from '@/stores';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import type { AgentCardsViewMode } from '@/stores/useAgentCenterStore';
import { UpdateButton } from '../features/UpdateButton';

const CARDS_VIEW_MODES: { mode: AgentCardsViewMode; icon: typeof LayoutGrid; title: string }[] = [
  { mode: 'solo', icon: Square, title: 'Solo view' },
  { mode: 'grid', icon: LayoutGrid, title: 'Grid view' },
  { mode: 'list', icon: List, title: 'List view' },
];

export function AgentViewHeader() {
  const { isRightPanelOpen, toggleRightPanel, isTerminalOpen, setIsTerminalOpen } =
    useLayoutStore();
  const { cardsViewMode, setCardsViewMode } = useAgentCenterStore();
  const { open: isSidebarOpen, openMobile, isMobile } = useSidebar();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  const { currentThreadId } = useCodexStore();
  const { activeSessionId } = useCCStore();
  // Show trigger when sidebar is closed; on mobile the Sheet is transient so always show
  const showTrigger = isMobile ? !openMobile : !isSidebarOpen;
  const hasActiveSession = currentThreadId || activeSessionId;

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
