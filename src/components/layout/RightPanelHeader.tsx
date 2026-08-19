import {
  Chrome,
  Diff,
  Files,
  Kanban,
  ListTodo,
  type LucideIcon,
  Maximize2,
  Minimize2,
  PanelRight,
  SquareTerminal,
  X,
} from 'lucide-react';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTrafficLightConfig } from '@/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLayoutStore } from '@/stores';
import type { RightPanelTab } from '@/stores/useLayoutStore';
import { useTodoStore } from '@/stores/useTodoStore';

export type { RightPanelTab };

interface TabConfig {
  tab: RightPanelTab;
  icon: LucideIcon;
  label: string;
}

// Order tabs the way users scan them: work-in-progress first, reference last.
const TAB_BUTTONS: TabConfig[] = [
  { tab: 'diff', icon: Diff, label: 'Review' },
  { tab: 'todo', icon: ListTodo, label: 'Todos' },
  { tab: 'terminal', icon: SquareTerminal, label: 'Terminal' },
  { tab: 'webpreview', icon: Chrome, label: 'Browser' },
  { tab: 'files', icon: Files, label: 'Files' },
  { tab: 'tasks', icon: Kanban, label: 'Kanban' },
];

export function RightPanelHeader() {
  const isMobile = useIsMobile();
  const {
    activeRightPanelTab,
    setActiveRightPanelTab,
    openRightPanelTabs,
    closeRightPanelTab,
    isRightPanelOpen,
    setRightPanelOpen,
    toggleRightPanel,
    isRightPanelFocused,
    toggleRightPanelFocused,
    isSidebarOpen,
  } = useLayoutStore();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  const todos = useTodoStore((state) => state.todos);

  const openTab = (tab: RightPanelTab) => {
    setActiveRightPanelTab(tab);
    setRightPanelOpen(true);
  };

  const closeTab = (event: React.MouseEvent, tab: RightPanelTab) => {
    event.stopPropagation();
    closeRightPanelTab(tab);
  };

  const closedTabs = TAB_BUTTONS.filter((t) => !openRightPanelTabs.includes(t.tab));

  // A captured todo lands in a panel the user may not be looking at, so the
  // tab carries the count until they open it.
  const openTodoCount = todos.filter((todo) => !todo.isDone).length;

  if (openRightPanelTabs.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-end gap-0.5 p-1 shrink-0">
          {!isMobile && isRightPanelOpen && (
            <Button
              variant={isRightPanelFocused ? 'secondary' : 'ghost'}
              size="icon"
              onClick={toggleRightPanelFocused}
              title={isRightPanelFocused ? 'Exit focus mode' : 'Focus on this panel'}
            >
              {isRightPanelFocused ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleRightPanel} title="Hide right panel">
            <PanelRight className="size-4" />
          </Button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Open a panel</span>
          <div className="flex flex-col items-center gap-1">
            {TAB_BUTTONS.map(({ tab, icon: Icon, label }) => (
              <Button
                key={tab}
                variant="ghost"
                size="sm"
                onClick={() => openTab(tab)}
                className="gap-1.5 px-3 justify-start w-32"
              >
                <Icon className="size-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-1 py-1 h-11 border-b border-white/10 shrink-0 ${needsTrafficLightOffset && isRightPanelFocused && !isMobile ? 'pl-20' : ''}`}
    >
      <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">
        {isRightPanelFocused && !isMobile && !isSidebarOpen && (
          <>
            <SidebarTrigger />
            <NewAgentButton />
          </>
        )}
        {openRightPanelTabs.map((tab) => {
          const config = TAB_BUTTONS.find((t) => t.tab === tab);
          if (!config) return null;
          const Icon = config.icon;
          return (
            <div key={tab} className="relative group shrink-0">
              <Button
                variant={activeRightPanelTab === tab ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => openTab(tab)}
                className="gap-1.5 pl-2 pr-6"
              >
                <Icon className="size-4" />
                <span className="text-xs hidden lg:block">{config.label}</span>
                {tab === 'todo' && openTodoCount > 0 && activeRightPanelTab !== tab && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">
                    {openTodoCount}
                  </span>
                )}
              </Button>
              <button
                type="button"
                onClick={(e) => closeTab(e, tab)}
                title={`Close ${config.label}`}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
        {closedTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 size-7" title="Open panel">
                <span className="text-base leading-none">+</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {closedTabs.map(({ tab, icon: Icon, label }) => (
                <DropdownMenuItem key={tab} onClick={() => openTab(tab)}>
                  <Icon className="size-4" />
                  {label}
                  {tab === 'todo' && openTodoCount > 0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {openTodoCount}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!isMobile && isRightPanelOpen && (
          <Button
            variant={isRightPanelFocused ? 'secondary' : 'ghost'}
            size="icon"
            onClick={toggleRightPanelFocused}
            title={isRightPanelFocused ? 'Exit focus mode' : 'Focus on this panel'}
          >
            {isRightPanelFocused ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={toggleRightPanel} title="Hide right panel">
          <PanelRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
