import { Chrome, Diff, Files, ListTodo, PanelRight, StickyNote, Terminal } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLayoutStore } from '@/stores';
import { useGitWatch } from '@/hooks/useGitWatch';
import { useGitStatsStore } from '@/stores/useGitStatsStore';
import { useWorkspaceStore } from '@/stores';
import { GitActions, GitStatsIndicator } from '@/components/features/git';
import { useCallback, useEffect, useRef } from 'react';

type RightPanelTab = 'diff' | 'tasks' | 'note' | 'files' | 'webpreview';

interface TabConfig {
  tab: RightPanelTab;
  icon: LucideIcon;
  title: string;
}

const TAB_BUTTONS: TabConfig[] = [
  { tab: 'webpreview', icon: Chrome, title: 'Web Preview' },
  { tab: 'tasks', icon: ListTodo, title: 'Tasks' },
  { tab: 'note', icon: StickyNote, title: 'Notes' },
  { tab: 'files', icon: Files, title: 'Files' },
];

export function RightPanelHeader() {
  const {
    isRightPanelOpen,
    toggleRightPanel,
    setRightPanelOpen,
    activeRightPanelTab,
    setActiveRightPanelTab,
    isTerminalOpen,
    setIsTerminalOpen,
  } = useLayoutStore();

  const { cwd } = useWorkspaceStore();
  const { refreshStats } = useGitStatsStore();

  // Use refs to avoid stale closures without adding them to effect deps.
  const cwdRef = useRef(cwd);
  const refreshStatsRef = useRef(refreshStats);
  cwdRef.current = cwd;
  refreshStatsRef.current = refreshStats;

  // Eagerly refresh (with loading state) whenever cwd changes.
  useEffect(() => {
    if (!cwd) return;
    void refreshStats(cwd, false);
    // Only re-run when cwd actually changes — refreshStats is stable from zustand.
  }, [cwd, refreshStats]);

  // Stable silent refresher for git watch — never changes identity so useGitWatch
  // doesn't teardown/recreate its fs watcher on every render.
  const silentRefresher = useCallback(() => {
    const currentCwd = cwdRef.current;
    if (currentCwd) void refreshStatsRef.current(currentCwd, true);
  }, []); // empty deps — reads latest values via refs

  useGitWatch(cwd, silentRefresher, Boolean(cwd));

  const openRightPanelTab = useCallback(
    (tab: RightPanelTab) => {
      setActiveRightPanelTab(tab);
      setRightPanelOpen(true);
    },
    [setActiveRightPanelTab, setRightPanelOpen]
  );

  return (
    <div className="flex items-center gap-2">
      <GitActions />
      {isRightPanelOpen && (
        <div className="flex items-center">
          {TAB_BUTTONS.map(({ tab, icon: Icon, title }) => (
            <Button
              key={tab}
              variant={activeRightPanelTab === tab ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => openRightPanelTab(tab)}
              title={title}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      )}

      {/* Terminal: toggle panel visibility; creates first tab if none exist */}
      <Button
        variant={isTerminalOpen ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
        title={isTerminalOpen ? 'Hide terminal' : 'Show terminal'}
      >
        <Terminal className="size-4" />
      </Button>
      <Button
        variant={activeRightPanelTab === 'diff' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => openRightPanelTab('diff')}
        title="Diff"
        className="rounded-md border pr-3"
      >
        <Diff className="size-4" />
        <GitStatsIndicator />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleRightPanel}
        title={isRightPanelOpen ? 'Hide right panel' : 'Show right panel'}
      >
        <PanelRight className="size-4" />
      </Button>
    </div>
  );
}
