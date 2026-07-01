import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@git-diff-view/react/styles/diff-view-pure.css';
import {
  gitStageFiles,
  gitStatus,
  gitUnstageFiles,
  type GitStatusResponse,
} from '@/services/tauri';
import { isGitRepo } from '@/services/tauri/git';
import { useGitWatch } from '@/hooks/useGitWatch';
import { useWorkspaceStore, useLayoutStore } from '@/stores';
import { GitDiffDialogs } from './GitDiffDialogs';
import { GitDiffFileList } from './GitDiffFileList';
import { GitDiffTopBar } from './GitDiffTopBar';
import { GitFileTreePanel } from './GitFileTreePanel';
import type { DiffSection, DiffSource, GitDiffPanelProps } from './types';
import { buildFileTree } from './utils';

export function GitDiffPanel({ cwd, isActive }: GitDiffPanelProps) {
  const { selectedFilePath, setSelectedFilePath } = useWorkspaceStore();
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
  const [userSelectedDiffPath, setUserSelectedDiffPath] = useState<string | null>(null);
  const [userSelectedDiffSection, setUserSelectedDiffSection] = useState<DiffSection>('unstaged');
  const selectedDiffPathRef = useRef<string | null>(null);
  const selectedDiffSectionRef = useRef<DiffSection>('unstaged');
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

  // Reset git state inline during render when cwd becomes falsy (run once)
  if (!cwd && !hasResetGitStateRef.current && (gitData !== null || gitError !== null || gitLoading)) {
    setGitData(null);
    setGitError(null);
    setGitLoading(false);
    setUserSelectedDiffPath(null);
    hasResetGitStateRef.current = true;
  }

  const handleDiffSourceChange = useCallback((source: DiffSource) => {
    setDiffSource(source);
    if (source === 'unstaged' || source === 'staged') {
      setUserSelectedDiffSection(source);
    }
  }, []);

  const handleDiffSectionChange = useCallback((section: DiffSection) => {
    setUserSelectedDiffSection(section);
    setDiffSource(section as unknown as DiffSource);
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

  const silentRefresh = useCallback(() => { void refreshGitStatus(); }, [refreshGitStatus]);
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

  // Derive selectedDiffPath and selectedDiffSection from workspace selectedFilePath
  // This replaces the effect-based sync that react-doctor flagged
  const derivedSelection = useMemo(() => {
    if (!isActive || !cwd || !selectedFilePath) {
      return { section: userSelectedDiffSection, path: userSelectedDiffPath };
    }

    const cwdPosix = toPosix(cwd).replace(/\/+$/, '');
    const selectedPosix = toPosix(selectedFilePath);
    if (!selectedPosix.startsWith(`${cwdPosix}/`)) {
      return { section: userSelectedDiffSection, path: userSelectedDiffPath };
    }

    const relativePath = normalizeRelativePath(selectedPosix.slice(cwdPosix.length + 1));
    const unstagedMap = new Map(unstagedEntries.map((e) => [normalizeRelativePath(e.path), e.path] as const));
    const stagedMap = new Map(stagedEntries.map((e) => [normalizeRelativePath(e.path), e.path] as const));

    if (unstagedMap.has(relativePath)) {
      return { section: 'unstaged' as DiffSection, path: unstagedMap.get(relativePath) ?? null };
    }
    if (stagedMap.has(relativePath)) {
      return { section: 'staged' as DiffSection, path: stagedMap.get(relativePath) ?? null };
    }

    return { section: userSelectedDiffSection, path: userSelectedDiffPath };
  }, [isActive, cwd, selectedFilePath, toPosix, normalizeRelativePath, unstagedEntries, stagedEntries, userSelectedDiffSection, userSelectedDiffPath]);

  const selectedDiffSection = derivedSelection.section;
  const selectedDiffPath = derivedSelection.path;

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

  // Derive selectedDiffPath ensuring it points to a valid file (fallback to first entry)
  // This replaces the effect-based sync that react-doctor flagged
  const effectiveSelectedDiffPath = useMemo(() => {
    if (filteredEntries.length === 0) return null;
    const normalizedSelected = selectedDiffPath ? normalizeRelativePath(selectedDiffPath) : null;
    const hasMatch =
      normalizedSelected !== null &&
      filteredEntries.some((entry) => normalizeRelativePath(entry.path) === normalizedSelected);
    if (!hasMatch) return filteredEntries[0].path;
    return selectedDiffPath;
  }, [filteredEntries, normalizeRelativePath, selectedDiffPath]);

  const resolveDiffPath = useCallback(
    (relativePath: string) => {
      if (!cwd) return relativePath;
      if (relativePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(relativePath)) return relativePath;
      const sep = cwd.includes('\\') ? '\\' : '/';
      return cwd.endsWith(sep) ? `${cwd}${relativePath}` : `${cwd}${sep}${relativePath}`;
    },
    [cwd]
  );

  // Sync selectedDiffPath → selectedFilePath (workspace)
  useEffect(() => {
    if (!isActive || !effectiveSelectedDiffPath) return;
    const resolved = resolveDiffPath(effectiveSelectedDiffPath);
    const sameFile =
      selectedFilePath !== null &&
      normalizeRelativePath(toPosix(selectedFilePath)) === normalizeRelativePath(toPosix(resolved));
    if (!sameFile) setSelectedFilePath(resolved);
  }, [isActive, normalizeRelativePath, resolveDiffPath, effectiveSelectedDiffPath, selectedFilePath, setSelectedFilePath, toPosix]);

  useEffect(() => { selectedDiffPathRef.current = effectiveSelectedDiffPath; }, [effectiveSelectedDiffPath]);
  useEffect(() => { selectedDiffSectionRef.current = selectedDiffSection; }, [selectedDiffSection]);

  const handleFileSelect = useCallback(
    (path: string) => {
      setUserSelectedDiffPath(path);
      setSelectedFilePath(resolveDiffPath(path));
    },
    [resolveDiffPath, setSelectedFilePath]
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
    setSelectedFilePath(resolveDiffPath(path));
  };

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
          onRevertConfirmOpenChange={() => { }}
          onBulkStageConfirm={() => { void handleBulkStageConfirm(); }}
          onRevertConfirm={() => { }}
        />
      </div>
    </div>
  );
}