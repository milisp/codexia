import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@git-diff-view/react/styles/diff-view-pure.css';
import {
  type AggregatedFileChange,
  aggregateTurnChangesFromContext,
  getDiffViewerProps,
  type RenderEventContext,
} from '@/components/codex/items/fileChangeLogic';
import { SummaryFileChanges } from '@/components/codex/items/SummaryFileChanges';
import { useCodexStore } from '@/components/codex/stores/useCodexStore';
import { useGitWatch } from '@/hooks/useGitWatch';
import {
  type GitStatusResponse,
  gitStageFiles,
  gitStatus,
  gitUnstageFiles,
} from '@/services/tauri';
import { isGitRepo } from '@/services/tauri/git';
import { useLayoutStore, useWorkspaceStore } from '@/stores';
import { GitDiffDialogs } from './GitDiffDialogs';
import { GitDiffFileList } from './GitDiffFileList';
import { GitDiffTopBar } from './GitDiffTopBar';
import { GitFileTreePanel } from './GitFileTreePanel';
import type { DiffSection, DiffSource, GitDiffPanelProps } from './types';
import { buildFileTree } from './utils';

export default function GitDiffPanel({ cwd, isActive }: GitDiffPanelProps) {
  const { activeFile, openFile } = useWorkspaceStore();
  const { diffWordWrap } = useLayoutStore();
  const [gitData, setGitData] = useState<GitStatusResponse | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [diffRefreshKey, setDiffRefreshKey] = useState(0);
  const [showFileTree, setShowFileTree] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [diffSource, setDiffSource] = useState<DiffSource>('unstaged');
  const [bulkStageDialogOpen, setBulkStageDialogOpen] = useState(false);
  const [bulkStageLoading, setBulkStageLoading] = useState(false);

  // Track user explicit panel selection to decouple from global tab switches
  const [userSelectedDiffPath, setUserSelectedDiffPath] = useState<string | null>(null);
  const [userSelectedDiffSection, setUserSelectedDiffSection] = useState<DiffSection>('unstaged');

  // Track if user explicitly selected a section (via dropdown or file list click)
  // to prevent auto-detection from overriding explicit user choice
  const userExplicitlySelectedSectionRef = useRef(false);

  // Track internal programmatic opens to prevent feedback loops
  const lastInternallyOpenedFileRef = useRef<string | null>(null);
  const [cwdTrigger, setCwdTrigger] = useState(0);

  const toPosix = useCallback((value: string) => value.replace(/\\/g, '/'), []);
  const normalizeRelativePath = useCallback(
    (value: string) => toPosix(value).replace(/^\/+/, ''),
    [toPosix]
  );

  const prevCwdRef = useRef(cwd);
  const hasResetGitStateRef = useRef(false);
  if (cwd !== prevCwdRef.current) {
    prevCwdRef.current = cwd;
    setCwdTrigger((prev) => prev + 1);
    hasResetGitStateRef.current = false;
  }

  // Get codex events for the current thread
  const { events } = useCodexStore();
  const currentThreadId = useCodexStore((state) => state.currentThreadId);
  const currentThreadEvents = currentThreadId ? events[currentThreadId] || [] : [];
  const latestTurnId = useMemo(() => {
    let lastTurnId: string | null = null;
    for (let i = currentThreadEvents.length - 1; i >= 0; i -= 1) {
      const event = currentThreadEvents[i];
      if (event.method === 'turn/completed') {
        lastTurnId = event.params.turn.id;
        break;
      }
    }
    return lastTurnId;
  }, [currentThreadEvents]);

  // Build render context for the latest turn
  const renderContext = useMemo((): RenderEventContext | undefined => {
    if (!latestTurnId) return undefined;
    const eventIndex = currentThreadEvents.findIndex(
      (e) => e.method === 'turn/completed' && e.params.turn.id === latestTurnId
    );
    if (eventIndex < 0) return undefined;
    return { events: currentThreadEvents, eventIndex };
  }, [currentThreadEvents, latestTurnId]);

  if (
    !cwd &&
    !hasResetGitStateRef.current &&
    (gitData !== null || gitError !== null || gitLoading)
  ) {
    setGitData(null);
    setGitError(null);
    setGitLoading(false);
    setUserSelectedDiffPath(null);
    hasResetGitStateRef.current = true;
  }

  const handleDiffSourceChange = useCallback((source: DiffSource) => {
    setDiffSource(source);
    if (source === 'staged' || source === 'unstaged') {
      setUserSelectedDiffSection(source);
      setUserSelectedDiffPath(null);
      userExplicitlySelectedSectionRef.current = true;
    }
  }, []);

  const handleDiffSectionChange = useCallback((section: DiffSection) => {
    setUserSelectedDiffSection(section);
    setUserSelectedDiffPath(null);
    userExplicitlySelectedSectionRef.current = true;
  }, []);

  const refreshGitStatus = useCallback(async () => {
    if (!cwd) return;
    if (!(await isGitRepo(cwd))) {
      setGitData(null);
      setGitError(null);
      setGitLoading(false);
      return;
    }
    setGitError(null);
    try {
      const status = await gitStatus(cwd);
      setGitData((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(status)) return prev;
        return status;
      });
      setDiffRefreshKey((k) => k + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
      setGitData(null);
    } finally {
      setGitLoading(false);
    }
  }, [cwd]);

  const silentRefresh = useCallback(() => {
    void refreshGitStatus();
  }, [refreshGitStatus]);
  useGitWatch(cwd, silentRefresh);

  useEffect(() => {
    if (cwdTrigger === 0) return;
    if (!cwd) return;
    refreshGitStatus();
  }, [cwdTrigger, refreshGitStatus]);

  useEffect(() => {
    if (!isActive || !cwd) return;
    refreshGitStatus();
  }, [isActive, cwd, refreshGitStatus]);

  const stagedEntries = useMemo(
    () =>
      (gitData?.entries ?? [])
        .filter((entry) => entry.index_status !== ' ' && entry.index_status !== '?')
        .sort((a, b) => a.path.localeCompare(b.path)),
    [gitData]
  );

  const unstagedEntries = useMemo(
    () =>
      (gitData?.entries ?? [])
        .filter((entry) => entry.worktree_status !== ' ' || entry.index_status === '?')
        .sort((a, b) => a.path.localeCompare(b.path)),
    [gitData]
  );

  // Derive active section based on priority: explicit user interaction > active tab context
  const selectedDiffSection = useMemo(() => {
    if (!isActive || !cwd || !activeFile) {
      return userSelectedDiffSection;
    }

    // If user explicitly selected a section (via dropdown or file list click), honor that
    if (userExplicitlySelectedSectionRef.current) {
      return userSelectedDiffSection;
    }

    // Honor the section if the tab change originated from this panel's list click
    if (lastInternallyOpenedFileRef.current === activeFile) {
      return userSelectedDiffSection;
    }

    // Infer section automatically only when a tab is selected independently outside git view
    const cwdPosix = toPosix(cwd).replace(/\/+$/, '');
    const activePosix = toPosix(activeFile);
    if (!activePosix.startsWith(`${cwdPosix}/`)) {
      return userSelectedDiffSection;
    }

    const relativePath = normalizeRelativePath(activePosix.slice(cwdPosix.length + 1));
    const unstagedMap = new Map(
      unstagedEntries.map((e) => [normalizeRelativePath(e.path), e.path] as const)
    );
    const stagedMap = new Map(
      stagedEntries.map((e) => [normalizeRelativePath(e.path), e.path] as const)
    );

    if (unstagedMap.has(relativePath)) return 'unstaged';
    if (stagedMap.has(relativePath)) return 'staged';

    return userSelectedDiffSection;
  }, [
    isActive,
    cwd,
    activeFile,
    toPosix,
    normalizeRelativePath,
    unstagedEntries,
    stagedEntries,
    userSelectedDiffSection,
  ]);

  const activeEntries = useMemo(
    () => (selectedDiffSection === 'staged' ? stagedEntries : unstagedEntries),
    [selectedDiffSection, stagedEntries, unstagedEntries]
  );

  const filteredEntries = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return activeEntries;
    return activeEntries.filter((entry) => entry.path.toLowerCase().includes(keyword));
  }, [activeEntries, filterText]);

  const fileTree = useMemo(() => buildFileTree(filteredEntries), [filteredEntries]);

  const bulkStagePaths = useMemo(() => {
    if (selectedDiffSection !== 'unstaged') return [];
    return [...new Set(filteredEntries.map((entry) => entry.path))];
  }, [filteredEntries, selectedDiffSection]);

  // Determine effective relative path to highlight in current list
  const effectiveSelectedDiffPath = useMemo(() => {
    if (filteredEntries.length === 0) return null;

    if (userSelectedDiffPath) {
      const normUserPath = normalizeRelativePath(userSelectedDiffPath);
      const hasMatch = filteredEntries.some((e) => normalizeRelativePath(e.path) === normUserPath);
      if (hasMatch) return userSelectedDiffPath;
    }

    if (activeFile && cwd) {
      const cwdPosix = toPosix(cwd).replace(/\/+$/, '');
      const activePosix = toPosix(activeFile);
      if (activePosix.startsWith(`${cwdPosix}/`)) {
        const relativePath = normalizeRelativePath(activePosix.slice(cwdPosix.length + 1));
        const match = filteredEntries.find((e) => normalizeRelativePath(e.path) === relativePath);
        if (match) return match.path;
      }
    }

    return filteredEntries[0].path;
  }, [filteredEntries, userSelectedDiffPath, activeFile, cwd, toPosix, normalizeRelativePath]);

  const resolveDiffPath = useCallback(
    (relativePath: string) => {
      if (!cwd) return relativePath;
      if (relativePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(relativePath)) return relativePath;
      const sep = cwd.includes('\\') ? '\\' : '/';
      return cwd.endsWith(sep) ? `${cwd}${relativePath}` : `${cwd}${sep}${relativePath}`;
    },
    [cwd]
  );

  // Sync selection to workspace via modern openFile API without locking up the view state
  useEffect(() => {
    if (!isActive || !effectiveSelectedDiffPath) return;
    const resolved = resolveDiffPath(effectiveSelectedDiffPath);
    if (activeFile !== resolved) {
      lastInternallyOpenedFileRef.current = resolved;
      openFile(resolved);
    }
  }, [isActive, resolveDiffPath, effectiveSelectedDiffPath, activeFile, openFile]);

  const handleFileSelect = useCallback(
    (path: string) => {
      setUserSelectedDiffPath(path);
      const resolved = resolveDiffPath(path);
      lastInternallyOpenedFileRef.current = resolved;
      openFile(resolved);
      userExplicitlySelectedSectionRef.current = true;
    },
    [resolveDiffPath, openFile]
  );

  const runStage = async (paths: string[]) => {
    if (!cwd || paths.length === 0) return;
    await gitStageFiles(cwd, paths);
    await refreshGitStatus();
  };

  const runUnstage = async (paths: string[]) => {
    if (!cwd || paths.length === 0) return;
    await gitUnstageFiles(cwd, paths);
    await refreshGitStatus();
  };

  const handleBulkStageConfirm = async () => {
    if (!cwd || bulkStagePaths.length === 0) return;
    setBulkStageLoading(true);
    try {
      await runStage(bulkStagePaths);
      setBulkStageDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
    } finally {
      setBulkStageLoading(false);
    }
  };

  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectPath = (section: DiffSection, path: string) => {
    setUserSelectedDiffSection(section);
    setUserSelectedDiffPath(path);
    userExplicitlySelectedSectionRef.current = true;
    const resolved = resolveDiffPath(path);
    lastInternallyOpenedFileRef.current = resolved;
    openFile(resolved);
  };

  // Compute aggregated changes for latest-turn
  const latestTurnChanges = useMemo((): AggregatedFileChange[] => {
    if (!latestTurnId || !renderContext) return [];
    return aggregateTurnChangesFromContext(latestTurnId, renderContext);
  }, [latestTurnId, renderContext]);

  // When diffSource is 'latest-turn', show the aggregated changes from the latest turn
  if (diffSource === 'latest-turn') {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden relative">
        <GitDiffTopBar
          cwd={cwd}
          gitLoading={gitLoading}
          diffSource={diffSource}
          onDiffSourceChange={handleDiffSourceChange}
          selectedDiffSection={selectedDiffSection}
          onDiffSectionChange={handleDiffSectionChange}
          unstagedCount={unstagedEntries.length}
          stagedCount={stagedEntries.length}
          showFileTree={showFileTree}
          onToggleFileTree={() => setShowFileTree((v) => !v)}
          onRefresh={refreshGitStatus}
        />

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4">
            {latestTurnChanges.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                No file changes in latest turn
              </div>
            ) : (
              <SummaryFileChanges
                changes={latestTurnChanges}
                getDiffViewerProps={getDiffViewerProps}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden relative">
      <GitDiffTopBar
        cwd={cwd}
        gitLoading={gitLoading}
        diffSource={diffSource}
        onDiffSourceChange={handleDiffSourceChange}
        selectedDiffSection={selectedDiffSection}
        onDiffSectionChange={handleDiffSectionChange}
        unstagedCount={unstagedEntries.length}
        stagedCount={stagedEntries.length}
        showFileTree={showFileTree}
        onToggleFileTree={() => setShowFileTree((v) => !v)}
        onRefresh={refreshGitStatus}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <GitDiffFileList
          cwd={cwd}
          entries={filteredEntries}
          section={selectedDiffSection}
          diffSource={diffSource}
          wordWrapEnabled={diffWordWrap}
          selectedDiffPath={effectiveSelectedDiffPath}
          refreshKey={diffRefreshKey}
          onSelect={handleFileSelect}
          onRefreshStatus={refreshGitStatus}
        />

        {showFileTree && (
          <div className="hidden md:flex min-h-0">
            <GitFileTreePanel
              cwd={cwd}
              selectedDiffSection={selectedDiffSection}
              bulkStagePaths={bulkStagePaths}
              bulkStageLoading={bulkStageLoading}
              filterText={filterText}
              gitError={gitError}
              filteredEntriesCount={filteredEntries.length}
              fileTree={fileTree}
              selectedDiffPath={effectiveSelectedDiffPath}
              collapsedFolders={collapsedFolders}
              onOpenBulkStageDialog={() => setBulkStageDialogOpen(true)}
              onFilterTextChange={setFilterText}
              onToggleFolder={toggleFolder}
              onSelectPath={selectPath}
              onStage={runStage}
              onUnstage={runUnstage}
            />
          </div>
        )}

        <GitDiffDialogs
          bulkStageDialogOpen={bulkStageDialogOpen}
          bulkStagePathsCount={bulkStagePaths.length}
          bulkStageLoading={bulkStageLoading}
          revertConfirmOpen={false}
          revertLoading={false}
          onBulkStageDialogOpenChange={setBulkStageDialogOpen}
          onRevertConfirmOpenChange={() => {}}
          onBulkStageConfirm={() => {
            void handleBulkStageConfirm();
          }}
          onRevertConfirm={() => {}}
        />
      </div>
    </div>
  );
}
