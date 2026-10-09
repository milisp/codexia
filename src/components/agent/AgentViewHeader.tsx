import { LayoutGrid, PanelRight, SquareTerminal } from 'lucide-react';
import { useCodexStore } from '@/components/codex/stores';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { GitActions } from '@/features/git';
import { ProjectRunMenu } from '@/features/project-run/ProjectRunMenu';
import { PublishButton } from '@/features/publish/PublishButton';
import { useTrafficLightConfig } from '@/hooks';
import { isPhone } from '@/hooks/runtime';
import { useCCStore, useLayoutStore, useWorkspaceStore } from '@/stores';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { getFilename } from '@/utils/getFilename';
import { OpenAppMenu } from './openApp/OpenAppMenu';

export function AgentViewHeader() {
  const {
    isRightPanelOpen,
    toggleRightPanel,
    activeRightPanelTab,
    setActiveRightPanelTab,
    setRightPanelOpen,
  } = useLayoutStore();
  const isTerminalOpen = isRightPanelOpen && activeRightPanelTab === 'terminal';
  const { cards, cardsViewMode, setCardsViewMode } = useAgentCenterStore();
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
        {cwd && <ProjectRunMenu />}
        {cwd && <PublishButton />}
        {cwd && <OpenAppMenu path={cwd} />}
        {cards.length > 1 && (
          <Button
            variant={cardsViewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setCardsViewMode(cardsViewMode === 'grid' ? 'solo' : 'grid')}
            title={cardsViewMode === 'grid' ? 'Focus current session' : 'Grid view'}
            aria-label={cardsViewMode === 'grid' ? 'Focus current session' : 'Grid view'}
          >
            <LayoutGrid className="size-4" />
          </Button>
        )}
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
