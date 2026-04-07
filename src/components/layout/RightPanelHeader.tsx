import { Chrome, Diff, Files, PanelRight, StickyNote, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLayoutStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings';
import { useGitWatch } from '@/hooks/useGitWatch';
import { useGitStatsStore } from '@/stores/useGitStatsStore';
import { useWorkspaceStore } from '@/stores';
import { GitActions, GitStatsIndicator } from '@/components/features/git';
import { useCallback, useEffect } from 'react';

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

  const refreshGitStats = useCallback(() => {
    void refreshStats(cwd);
  }, [cwd, refreshStats]);

  const silentRefreshGitStats = useCallback(() => {
    void refreshStats(cwd, true);
  }, [cwd, refreshStats]);

  useEffect(() => {
    refreshGitStats();
  }, [cwd, refreshGitStats]);

  useGitWatch(cwd || null, silentRefreshGitStats, Boolean(cwd));

  const {
    showHeaderWebPreviewButton,
    showHeaderNotesButton,
    showHeaderFilesButton,
    showHeaderDiffButton,
    showHeaderTerminalButton,
  } = useSettingsStore();

  const openRightPanelTab = (tab: 'diff' | 'note' | 'files' | 'webpreview') => {
    setActiveRightPanelTab(tab);
    setRightPanelOpen(true);
  };

  return (
    <div className="flex items-center gap-2">
      <GitActions />
      {isRightPanelOpen && (
        <div className="flex items-center">
          {showHeaderWebPreviewButton && (
            <Button
              variant={activeRightPanelTab === 'webpreview' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => openRightPanelTab('webpreview')}
              title="Web Preview"
            >
              <Chrome className="size-4" />
            </Button>
          )}
          {showHeaderNotesButton && (
            <Button
              variant={activeRightPanelTab === 'note' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => openRightPanelTab('note')}
              title="Notes"
            >
              <StickyNote className="size-4" />
            </Button>
          )}
          {showHeaderFilesButton && (
            <Button
              variant={activeRightPanelTab === 'files' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => openRightPanelTab('files')}
              title="Files"
            >
              <Files className="size-4" />
            </Button>
          )}
        </div>
      )}

      {showHeaderTerminalButton && (
        <Button
          variant={isTerminalOpen ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          title={isTerminalOpen ? 'Hide terminal' : 'Show terminal'}
        >
          <Terminal className="size-4" />
        </Button>
      )}
      {showHeaderDiffButton && (
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
      )}
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
