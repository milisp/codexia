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
import { useWorkspaceStore } from '@/stores';
import { useLayoutStore } from '@/stores/settings';
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
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [selectedDiffSection, setSelectedDiffSection] = useState<DiffSection>('unstaged');
  const [showFileTree, setShowFileTree] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [diffSource, setDiffSource] = useState<DiffSource>('uncommitted');
  const [bulkStageDialogOpen, setBulkStageDialogOpen] = useState(false);
  const [bulkStageLoading, setBulkStageLoading] = useState(false);
  const selectedDiffPathRef = useRef<string | null>(null);
  const selectedDiffSectionRef = useRef<DiffSection>('unstaged');

  const toPosix = useCallback((value: string) => value.replace(/\\/g, '/'), []);
  const normalizeRelativePath = useCallback(
    (value: string) => toPosix(value).replace(/^\/+/, ''),
    [toPosix]
  );

  const refreshGitStatus = useCallback(async () => {
    if (!cwd) return;
    // Non-git cwd: clear, don't error-flash. Same gate as useGitWatch.
    if (!(await isGitRepo(cwd))) {
      setGitData(null);
      setGitError(null);
      setGitLoading(false);
      return;
    }
    setGitLoading(true);
    setGitError(null);
    try {
      const status = await gitStatus(cwd);
      setGitData(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
      setGitData(null);
    } finally {
      setGitLoading(false);
    }
  }, [cwd]);

  useGitWatch(cwd, refreshGitStatus, isActive);

  useEffect(() => {
    if (cwd) return;
    setGitData(null);
    setGitError(null);
    setGitLoading(false);
    setSelectedDiffPath(null);
  }, [cwd]);

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

  // Keep selectedDiffPath pointing at a valid file
  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedDiffPath(null);
      return;
    }
    const normalizedSelected = selectedDiffPath ? normalizeRelativePath(selectedDiffPath) : null;
    const hasMatch =
      normalizedSelected !== null &&
      filteredEntries.some((entry) => normalizeRelativePath(entry.path) === normalizedSelected);
    if (!hasMatch) {
      setSelectedDiffPath(filteredEntries[0].path);
    }
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
    if (!isActive || !selectedDiffPath) return;
    const resolved = resolveDiffPath(selectedDiffPath);
    const sameFile =
      selectedFilePath !== null &&
      normalizeRelativePath(toPosix(selectedFilePath)) === normalizeRelativePath(toPosix(resolved));
    if (!sameFile) setSelectedFilePath(resolved);
  }, [isActive, normalizeRelativePath, resolveDiffPath, selectedDiffPath, selectedFilePath, setSelectedFilePath, toPosix]);

  useEffect(() => { selectedDiffPathRef.current = selectedDiffPath; }, [selectedDiffPath]);
  useEffect(() => { selectedDiffSectionRef.current = selectedDiffSection; }, [selectedDiffSection]);

  // Sync selectedFilePath (workspace) → selectedDiffPath
  useEffect(() => {
    if (!isActive || !cwd || !selectedFilePath) return;

    const currentPath = selectedDiffPathRef.current;
    const currentSection = selectedDiffSectionRef.current;
    const resolvedCurrent = currentPath ? resolveDiffPath(currentPath) : null;
    if (
      resolvedCurrent &&
      normalizeRelativePath(toPosix(selectedFilePath)) === normalizeRelativePath(toPosix(resolvedCurrent))
    ) return;

    const cwdPosix = toPosix(cwd).replace(/\/+$/, '');
    const selectedPosix = toPosix(selectedFilePath);
    if (!selectedPosix.startsWith(`${cwdPosix}/`)) return;

    const relativePath = normalizeRelativePath(selectedPosix.slice(cwdPosix.length + 1));
    const unstagedMap = new Map(unstagedEntries.map((e) => [normalizeRelativePath(e.path), e.path] as const));
    const stagedMap = new Map(stagedEntries.map((e) => [normalizeRelativePath(e.path), e.path] as const));

    let targetSection: DiffSection | null = null;
    let targetPath: string | null = null;
    if (unstagedMap.has(relativePath)) {
      targetSection = 'unstaged';
      targetPath = unstagedMap.get(relativePath) ?? null;
    } else if (stagedMap.has(relativePath)) {
      targetSection = 'staged';
      targetPath = stagedMap.get(relativePath) ?? null;
    }

    if (!targetSection || !targetPath) return;
    if (currentSection !== targetSection) setSelectedDiffSection(targetSection);
    if (currentPath !== targetPath) setSelectedDiffPath(targetPath);
  }, [cwd, isActive, normalizeRelativePath, resolveDiffPath, selectedFilePath, stagedEntries, toPosix, unstagedEntries]);

  const handleFileSelect = useCallback(
    (path: string) => {
      setSelectedDiffPath(path);
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
    setSelectedDiffSection(section);
    setSelectedDiffPath(path);
    setSelectedFilePath(resolveDiffPath(path));
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden relative">
      <GitDiffTopBar
        cwd={cwd}
        gitLoading={gitLoading}
        diffSource={diffSource}
        onDiffSourceChange={setDiffSource}
        selectedDiffSection={selectedDiffSection}
        onDiffSectionChange={setSelectedDiffSection}
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
          selectedDiffPath={selectedDiffPath}
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
              selectedDiffPath={selectedDiffPath}
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
          onBulkStageConfirm={() => { void handleBulkStageConfirm(); }}
          onRevertConfirm={() => {}}
        />
      </div>
    </div>
  );
}
