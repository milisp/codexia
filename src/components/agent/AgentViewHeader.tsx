import { LayoutGrid, List, PanelRight, Square, SquareTerminal } from 'lucide-react';
import { useCodexStore } from '@/components/codex/stores';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { GitActions } from '@/features/git';
import { useTrafficLightConfig } from '@/hooks';
import { isPhone } from '@/hooks/runtime';
import { useCCStore, useLayoutStore, useWorkspaceStore } from '@/stores';
import type { AgentCardsViewMode } from '@/stores/useAgentCenterStore';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { getFilename } from '@/utils/getFilename';
import { OpenAppMenu } from './openApp/OpenAppMenu';

const CARDS_VIEW_MODES: { mode: AgentCardsViewMode; icon: typeof LayoutGrid; title: string }[] = [
  { mode: 'solo', icon: Square, title: 'Solo view' },
  { mode: 'grid', icon: LayoutGrid, title: 'Grid view' },
  { mode: 'list', icon: List, title: 'List view' },
];

export function AgentViewHeader() {
  const {
    isRightPanelOpen,
    toggleRightPanel,
    activeRightPanelTab,
    setActiveRightPanelTab,
    setRightPanelOpen,
  } = useLayoutStore();
  const isTerminalOpen = isRightPanelOpen && activeRightPanelTab === 'terminal';
  const { cardsViewMode, setCardsViewMode } = useAgentCenterStore();
  const { open: isSidebarOpen, openMobile, isMobile } = useSidebar();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  const { currentThreadId } = useCodexStore();
  const { activeSessionId } = useCCStore();
  const { cwd } = useWorkspaceStore();
  // Show trigger when sidebar is closed; on mobile the Sheet is transient so always show
  const showTrigger = isMobile ? !openMobile : !isSidebarOpen;
  const hasActiveSession = currentThreadId || activeSessionId;

  // A phone gets its own header from MobileShell: no card layouts (one card
  // fills the screen), no right panel, and Back instead of a sidebar trigger.
  if (isPhone()) return null;

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
          </div>
        )}
        {!hasActiveSession && <Badge variant="secondary">{getFilename(cwd)}</Badge>}
      </div>
      <span className="flex items-center gap-1 pr-2">
        {cwd && <OpenAppMenu path={cwd} />}
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
              onClick={() => {
                setActiveRightPanelTab('terminal');
                setRightPanelOpen(true);
              }}
              title="Show terminal"
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
