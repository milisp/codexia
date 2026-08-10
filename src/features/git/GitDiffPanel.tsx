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
import { gitStageFiles, gitStatus, gitUnstageFiles } from '@/services/apiAdapt';
import { isGitRepo } from '@/services/apiAdapt/git';
import { useEditorStore, useLayoutStore } from '@/stores';
import { useGitDiffStore } from '@/stores/useGitDiffStore';
import { GitDiffDialogs } from './GitDiffDialogs';
import { GitDiffFileList, isDiffAutoExpanded } from './GitDiffFileList';
import { GitDiffTopBar } from './GitDiffTopBar';
import { GitFileTreePanel } from './GitFileTreePanel';
import type { DiffSection, GitDiffPanelProps } from './types';
import { buildFileTree } from './utils';

export default function GitDiffPanel({ cwd, isActive }: GitDiffPanelProps) {
  const { activeFile, openFile } = useEditorStore();
  const { diffWordWrap } = useLayoutStore();
  // Panel state lives in a store so it survives unmounts (right panel close,
  // focus-mode toggle, mobile drawer) instead of resetting on every remount.
  const {
    gitData,
    gitError,
    showFileTree,
    filterText,
    collapsedFolders,
    expandedDiffs,
    diffSource,
    selectedPath: userSelectedDiffPath,
    selectedSection: userSelectedDiffSection,
    sectionExplicitlySelected,
    lastInternallyOpenedFile,
    syncCwd,
    toggleFileTree,
    setDiffSource,
    setFilterText,
    toggleFolder,
    revealPath,
    setDiffExpanded,
    setAllDiffsExpanded,
    selectSection,
    selectPath: selectDiffPath,
    setLastInternallyOpenedFile,
    setGitData,
    setGitError,
  } = useGitDiffStore();

  const [gitLoading, setGitLoading] = useState(false);
  const [diffRefreshKey, setDiffRefreshKey] = useState(0);
  const [bulkStageDialogOpen, setBulkStageDialogOpen] = useState(false);
  const [bulkStageLoading, setBulkStageLoading] = useState(false);

  const [cwdTrigger, setCwdTrigger] = useState(0);

  const toPosix = useCallback((value: string) => value.replace(/\\/g, '/'), []);
  const normalizeRelativePath = useCallback(
    (value: string) => toPosix(value).replace(/^\/+/, ''),
    [toPosix]
  );

  const prevCwdRef = useRef(cwd);
  if (cwd !== prevCwdRef.current) {
    prevCwdRef.current = cwd;
    setCwdTrigger((prev) => prev + 1);
  }

  // Drops cached status and selection whenever the workspace changes.
  useEffect(() => {
    syncCwd(cwd);
    if (!cwd) setGitLoading(false);
  }, [cwd, syncCwd]);

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
      setGitData(status);
      setDiffRefreshKey((k) => k + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
      setGitData(null);
    } finally {
      setGitLoading(false);
    }
  }, [cwd, setGitData, setGitError]);

  const silentRefresh = useCallback(() => {
    void refreshGitStatus();
  }, [refreshGitStatus]);
  useGitWatch(cwd, silentRefresh);

  // biome-ignore lint/correctness/useExhaustiveDependencies: cwdTrigger is a reload signal
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
    if (sectionExplicitlySelected) {
      return userSelectedDiffSection;
    }

    // Honor the section if the tab change originated from this panel's list click
    if (lastInternallyOpenedFile === activeFile) {
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
    sectionExplicitlySelected,
    lastInternallyOpenedFile,
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

  // Fold/expand state is tracked per section so switching staged/unstaged
  // restores what that side looked like instead of inheriting the other's.
  const sectionCollapsedFolders = collapsedFolders[selectedDiffSection];
  const sectionExpandedDiffs = expandedDiffs[selectedDiffSection];

  const allDiffsCollapsed = useMemo(
    () =>
      filteredEntries.length > 0 &&
      filteredEntries.every(
        (entry, index) =>
          !(sectionExpandedDiffs[entry.path] ?? isDiffAutoExpanded(index, filteredEntries.length))
      ),
    [filteredEntries, sectionExpandedDiffs]
  );
  const toggleAllDiffs = useCallback(() => {
    setAllDiffsExpanded(
      selectedDiffSection,
      filteredEntries.map((entry) => entry.path),
      allDiffsCollapsed
    );
  }, [selectedDiffSection, filteredEntries, allDiffsCollapsed, setAllDiffsExpanded]);

  const handleFolderToggle = useCallback(
    (path: string) => toggleFolder(selectedDiffSection, path),
    [selectedDiffSection, toggleFolder]
  );

  const handleDiffExpandedChange = useCallback(
    (path: string, expanded: boolean) => setDiffExpanded(selectedDiffSection, path, expanded),
    [selectedDiffSection, setDiffExpanded]
  );

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

  // Keep the selected file visible in the tree when the selection moves into a collapsed folder
  useEffect(() => {
    if (!effectiveSelectedDiffPath) return;
    revealPath(selectedDiffSection, effectiveSelectedDiffPath);
  }, [effectiveSelectedDiffPath, selectedDiffSection, revealPath]);

  // Sync selection to workspace via modern openFile API without locking up the view state
  useEffect(() => {
    if (!isActive || !effectiveSelectedDiffPath) return;
    const resolved = resolveDiffPath(effectiveSelectedDiffPath);
    if (activeFile !== resolved) {
      setLastInternallyOpenedFile(resolved);
      openFile(resolved);
    }
  }, [
    isActive,
    resolveDiffPath,
    effectiveSelectedDiffPath,
    activeFile,
    openFile,
    setLastInternallyOpenedFile,
  ]);

  const handleFileSelect = useCallback(
    (path: string) => {
      selectDiffPath(path);
      const resolved = resolveDiffPath(path);
      setLastInternallyOpenedFile(resolved);
      openFile(resolved);
    },
    [resolveDiffPath, openFile, selectDiffPath, setLastInternallyOpenedFile]
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

  const selectPath = (section: DiffSection, path: string) => {
    selectSection(section);
    selectDiffPath(path);
    const resolved = resolveDiffPath(path);
    setLastInternallyOpenedFile(resolved);
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
          onDiffSourceChange={setDiffSource}
          selectedDiffSection={selectedDiffSection}
          onDiffSectionChange={selectSection}
          unstagedCount={unstagedEntries.length}
          stagedCount={stagedEntries.length}
          showFileTree={showFileTree}
          onToggleFileTree={toggleFileTree}
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
        onDiffSourceChange={setDiffSource}
        selectedDiffSection={selectedDiffSection}
        onDiffSectionChange={selectSection}
        unstagedCount={unstagedEntries.length}
        stagedCount={stagedEntries.length}
        showFileTree={showFileTree}
        onToggleFileTree={toggleFileTree}
        onRefresh={refreshGitStatus}
        allDiffsCollapsed={allDiffsCollapsed}
        canToggleAllDiffs={filteredEntries.length > 0}
        onToggleAllDiffs={toggleAllDiffs}
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
          expandedDiffs={sectionExpandedDiffs}
          onExpandedChange={handleDiffExpandedChange}
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
              collapsedFolders={sectionCollapsedFolders}
              onOpenBulkStageDialog={() => setBulkStageDialogOpen(true)}
              onFilterTextChange={setFilterText}
              onToggleFolder={handleFolderToggle}
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
