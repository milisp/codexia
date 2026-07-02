import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGitWatch } from '@/hooks/useGitWatch';
import { useLayoutStore, useWorkspaceStore } from '@/stores';
import { useGitStatsStore } from '@/stores/useGitStatsStore';
import { detectWebFramework } from '../features/web-preview/webFrameworkDetection';
import { RightPanelHeader } from './RightPanelHeader';

const NoteView = lazy(() => import('@/components/features/notes/NoteView'));
const FilesPanel = lazy(() => import('@/components/features/files/FilesPanel'));
const GitDiffPanel = lazy(() => import('@/components/features/git/GitDiffPanel'));
const WebPreview = lazy(() =>
  import('../features/web-preview/WebPreview').then((m) => ({ default: m.WebPreview }))
);
const TasksPanel = lazy(() => import('@/components/agent/TasksPanel'));

export function RightPanel() {
  const { activeRightPanelTab } = useLayoutStore();
  const { cwd } = useWorkspaceStore();
  const { refreshStats } = useGitStatsStore();
  const isMobile = useIsMobile();
  const [webPreviewUrl, setWebPreviewUrl] = useState('');

  // Use refs to avoid stale closures without adding them to effect deps.
  const cwdRef = useRef(cwd);
  const refreshStatsRef = useRef(refreshStats);
  cwdRef.current = cwd;
  refreshStatsRef.current = refreshStats;

  // Eagerly refresh (with loading state) whenever cwd changes.
  useEffect(() => {
    if (!cwd) return;
    void refreshStats(cwd, false);
  }, [cwd, refreshStats]);

  // Stable silent refresher for git watch — never changes identity so useGitWatch
  // doesn't teardown/recreate its fs watcher on every render.
  const silentRefresher = useCallback(() => {
    const currentCwd = cwdRef.current;
    if (currentCwd) void refreshStatsRef.current(currentCwd, true);
  }, []);

  useGitWatch(cwd, silentRefresher, Boolean(cwd));

  useEffect(() => {
    let cancelled = false;

    const loadWebPreviewUrl = async () => {
      if (!cwd) {
        if (!cancelled) setWebPreviewUrl('');
        return;
      }

      const framework = await detectWebFramework(cwd);
      if (!cancelled) {
        setWebPreviewUrl(framework?.devUrl ?? '');
      }
    };

    void loadWebPreviewUrl();

    return () => {
      cancelled = true;
    };
  }, [cwd]);

  return (
    <div
      className={`h-full w-full min-h-0 border-l border-white/10 flex flex-col overflow-hidden ${isMobile ? 'bg-sidebar' : 'bg-sidebar/30'}`}
    >
      <RightPanelHeader />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <Suspense fallback={null}>
            <div
              className={
                activeRightPanelTab === 'diff' ? 'h-full min-h-0 overflow-hidden' : 'hidden'
              }
            >
              <GitDiffPanel cwd={cwd} isActive={activeRightPanelTab === 'diff'} />
            </div>
          </Suspense>

          {activeRightPanelTab === 'tasks' && (
            <div className="h-full min-h-0 overflow-hidden">
              <Suspense fallback={null}>
                <TasksPanel />
              </Suspense>
            </div>
          )}

          {activeRightPanelTab === 'note' && (
            <div className="h-full min-h-0 overflow-hidden">
              <Suspense fallback={null}>
                <NoteView />
              </Suspense>
            </div>
          )}

          {activeRightPanelTab === 'files' && (
            <Suspense fallback={null}>
              <FilesPanel />
            </Suspense>
          )}

          {activeRightPanelTab === 'webpreview' && (
            <div className="h-full min-h-0 overflow-hidden">
              <Suspense fallback={null}>
                <WebPreview url={webPreviewUrl} onUrlChange={setWebPreviewUrl} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
