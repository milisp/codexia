import {
  Chrome,
  Diff,
  Files,
  ListTodo,
  Maximize2,
  Minimize2,
  PanelRight,
  SquareTerminal,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLayoutStore } from '@/stores';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrafficLightConfig } from '@/hooks';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { NewAgentButton } from '@/components/common/NewAgentButton';

export type RightPanelTab = 'diff' | 'tasks' | 'note' | 'files' | 'webpreview';

interface TabConfig {
  tab: RightPanelTab;
  icon: LucideIcon;
  label: string;
}

// Order tabs the way users scan them: work-in-progress first, reference last.
const TAB_BUTTONS: TabConfig[] = [
  { tab: 'diff', icon: Diff, label: 'Review' },
  { tab: 'tasks', icon: ListTodo, label: 'Tasks' },
  { tab: 'note', icon: StickyNote, label: 'Notes' },
  { tab: 'files', icon: Files, label: 'Files' },
  { tab: 'webpreview', icon: Chrome, label: 'Preview' },
];

export function RightPanelHeader() {
  const isMobile = useIsMobile();
  const {
    activeRightPanelTab,
    setActiveRightPanelTab,
    isRightPanelOpen,
    setRightPanelOpen,
    toggleRightPanel,
    isRightPanelFocused,
    toggleRightPanelFocused,
    isTerminalOpen,
    setIsTerminalOpen,
    isSidebarOpen,
  } = useLayoutStore();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);

  const openTab = (tab: RightPanelTab) => {
    setActiveRightPanelTab(tab);
    setRightPanelOpen(true);
  };

  return (
    <div className={`flex items-center justify-between gap-1 py-1 h-11 border-b border-white/10 shrink-0 ${needsTrafficLightOffset && isRightPanelFocused && !isMobile ? 'pl-20' : ''}`}>
      <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">
        {isRightPanelFocused && !isMobile && <><SidebarTrigger /><NewAgentButton /></>}
        {TAB_BUTTONS.map(({ tab, icon: Icon, label }) => (
          <Button
            key={tab}
            variant={activeRightPanelTab === tab ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => openTab(tab)}
            className="shrink-0 gap-1.5 px-2"
          >
            <Icon className="size-4" />
            <span className="text-xs hidden lg:block">{label}</span>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!isMobile && isRightPanelOpen && (
          <Button
            variant={isRightPanelFocused ? 'secondary' : 'ghost'}
            size="icon"
            onClick={toggleRightPanelFocused}
            title={isRightPanelFocused ? 'Exit focus mode' : 'Focus on this panel'}
          >
            {isRightPanelFocused ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        )}
        <Button
          variant={isTerminalOpen ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          title={isTerminalOpen ? 'Hide terminal' : 'Show terminal'}
        >
          <SquareTerminal className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleRightPanel}
          title="Hide right panel"
        >
          <PanelRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
