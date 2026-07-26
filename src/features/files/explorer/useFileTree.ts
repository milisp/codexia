import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  canonicalizePath,
  readDirectory,
  searchFilesByName,
  type TauriFileEntry,
} from '@/services/tauri';
import { useWorkspaceStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings';
import { getFilename } from '@/utils/getFilename';
import type { FileNode } from './types';
import { buildSearchTree, normalizeName, shouldSkipEntry, sortNodes } from './utils';
import { useDirWatch, type FsChangeEvent } from '@/hooks/useDirWatch';

export type UseFileTreeReturn = {
  treeContainerRef: React.RefObject<HTMLDivElement | null>;
  root: FileNode | null;
  displayRoot: FileNode | null;
  activeExpanded: Set<string>;
  loadingNodes: Set<string>;
  loading: boolean;
  error: string | null;
  filterText: string;
  setFilterText: (text: string) => void;
  refreshKey: number;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  searching: boolean;
  searchError: string | null;
  isSearching: boolean;
  hasSearchResults: boolean;
  toggle: (path: string) => void;
  loadChildren: (node: FileNode) => Promise<void>;
  selectedFilePath: string | null;
};

export function useFileTree(folder: string): UseFileTreeReturn {
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const [root, setRoot] = useState<FileNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchExpanded, setSearchExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMatches, setSearchMatches] = useState<TauriFileEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [folderTrigger, setFolderTrigger] = useState(0);
  const [searchTrigger, setSearchTrigger] = useState(0);

  const { hiddenNames } = useSettingsStore();
  const { selectedFilePath } = useWorkspaceStore();

  const autoExpandedTargetRef = useRef<string | null>(null);
  const prevFolderRef = useRef(folder);

  if (folder !== prevFolderRef.current) {
    prevFolderRef.current = folder;
    setFolderTrigger((prev) => prev + 1);
  }

  const hiddenSet = useMemo(() => new Set(hiddenNames.map(normalizeName)), [hiddenNames]);

  const listDir = useCallback(
    async (dir: string): Promise<FileNode[]> => {
      const resolvedDir = await canonicalizePath(dir);
      const entries = await readDirectory(resolvedDir);
      return sortNodes(
        entries
          .filter((e) => !shouldSkipEntry(e.name, hiddenSet))
          .map((e) => ({
            name: e.name,
            path: e.path,
            kind: e.is_dir ? ('dir' as const) : ('file' as const),
          }))
      );
    },
    [hiddenSet]
  );

  // Load root directory
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!folder) {
        if (isActive) {
          setRoot(null);
          setExpanded(new Set());
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const resolved = await canonicalizePath(folder);
        const label = getFilename(resolved);
        const children = await listDir(resolved);
        if (isActive) {
          setRoot({ name: label || folder, path: resolved, kind: 'dir', children });
          setExpanded(new Set([resolved]));
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : String(err) || 'Failed to read folder.');
          setRoot(null);
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [folder, listDir, refreshKey]);

  // Reset search state on folder change
  useEffect(() => {
    if (folderTrigger === 0) return;
    setSearchError(null);
    setSearchMatches([]);
    autoExpandedTargetRef.current = null;
  }, [folderTrigger]);

  const normalizedFilterText = filterText.trim();
  const isSearching = normalizedFilterText.length > 0;

  const prevIsSearchingRef = useRef(isSearching);
  const prevNormalizedFilterTextRef = useRef(normalizedFilterText);
  const prevFolderForSearchRef = useRef(folder);
  const prevHiddenNamesRef = useRef(hiddenNames);
  const prevRootPathRef = useRef(root?.path);

  if (
    isSearching !== prevIsSearchingRef.current ||
    normalizedFilterText !== prevNormalizedFilterTextRef.current ||
    folder !== prevFolderForSearchRef.current ||
    hiddenNames !== prevHiddenNamesRef.current ||
    root?.path !== prevRootPathRef.current
  ) {
    prevIsSearchingRef.current = isSearching;
    prevNormalizedFilterTextRef.current = normalizedFilterText;
    prevFolderForSearchRef.current = folder;
    prevHiddenNamesRef.current = hiddenNames;
    prevRootPathRef.current = root?.path;
    if (isSearching && folder) {
      setSearchTrigger((prev) => prev + 1);
    }
  }

  // Search
  useEffect(() => {
    let isActive = true;
    if (searchTrigger === 0) return;
    if (!isSearching || !folder) {
      setSearching(false);
      setSearchError(null);
      setSearchMatches([]);
      return () => {
        isActive = false;
      };
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const searchRoot = root?.path ?? (await canonicalizePath(folder));
        const matches = await searchFilesByName({
          root: searchRoot,
          query: normalizedFilterText,
          excludeFolders: hiddenNames,
          maxResults: 2000,
        });
        if (isActive) setSearchMatches(matches);
      } catch (err) {
        if (isActive) {
          setSearchError(err instanceof Error ? err.message : String(err) || 'Search failed.');
          setSearchMatches([]);
        }
      } finally {
        if (isActive) setSearching(false);
      }
    }, 200);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [searchTrigger]);

  const displayRoot = useMemo(() => {
    if (!root) return null;
    if (!isSearching) return root;
    return buildSearchTree(root, searchMatches);
  }, [isSearching, root, searchMatches]);

  const collectDirPaths = useCallback((node: FileNode): string[] => {
    if (node.kind !== 'dir') return [];
    return [node.path, ...(node.children?.flatMap(collectDirPaths) ?? [])];
  }, []);

  // Auto-expand search results
  useEffect(() => {
    if (!isSearching || !displayRoot) {
      setSearchExpanded(new Set());
      return;
    }
    const dirs = new Set<string>();
    for (const child of displayRoot.children ?? []) {
      for (const p of collectDirPaths(child)) dirs.add(p);
    }
    setSearchExpanded(dirs);
  }, [collectDirPaths, displayRoot, isSearching, normalizedFilterText]);

  const toggle = (path: string) => {
    const setter = isSearching ? setSearchExpanded : setExpanded;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const updateChildren = (node: FileNode, targetPath: string, children: FileNode[]): FileNode => {
    if (node.path === targetPath) return { ...node, children };
    if (!node.children) return node;
    return { ...node, children: node.children.map((c) => updateChildren(c, targetPath, children)) };
  };

  const findNodeByPath = (node: FileNode, targetPath: string): FileNode | null => {
    if (node.path === targetPath) return node;
    if (!node.children) return null;
    for (const child of node.children) {
      const match = findNodeByPath(child, targetPath);
      if (match) return match;
    }
    return null;
  };

  const loadChildren = async (node: FileNode) => {
    if (node.kind !== 'dir' || node.children) return;
    setLoadingNodes((prev) => new Set(prev).add(node.path));
    try {
      const children = await listDir(node.path);
      setRoot((prev) => (prev ? updateChildren(prev, node.path, children) : prev));
    } catch (err) {
      console.warn('Failed to read subdirectory', node.path, err);
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(node.path);
        return next;
      });
    }
  };

  // Auto-expand tree to reveal selected file
  useEffect(() => {
    if (!root || !selectedFilePath) return;
    let cancelled = false;
    const run = async () => {
      let canonicalSelected = selectedFilePath;
      try {
        canonicalSelected = await canonicalizePath(selectedFilePath);
      } catch {
        canonicalSelected = selectedFilePath;
      }
      if (cancelled) return;

      const toPosix = (v: string) => v.replace(/\\/g, '/');
      const rootPosix = toPosix(root.path).replace(/\/+$/, '');
      const selectedPosix = toPosix(canonicalSelected);
      if (selectedPosix === rootPosix || !selectedPosix.startsWith(`${rootPosix}/`)) return;

      const targetKey = `${root.path}::${selectedPosix}`;
      if (autoExpandedTargetRef.current === targetKey) return;
      autoExpandedTargetRef.current = targetKey;

      const parts = selectedPosix
        .slice(rootPosix.length + 1)
        .split('/')
        .filter(Boolean);
      if (parts.length <= 1) return;

      const sep = root.path.includes('\\') ? '\\' : '/';
      const ancestorDirs: string[] = [root.path];
      let cur = root.path;
      for (let i = 0; i < parts.length - 1; i += 1) {
        cur = `${cur}${cur.endsWith(sep) ? '' : sep}${parts[i]}`;
        ancestorDirs.push(cur);
      }

      setExpanded((prev) => {
        const next = new Set(prev);
        for (const d of ancestorDirs) next.add(d);
        return next.size === prev.size ? prev : next;
      });

      let snapshot = root;
      for (const dirPath of ancestorDirs) {
        if (cancelled) return;
        if (findNodeByPath(snapshot, dirPath)?.children) continue;
        try {
          const children = await listDir(dirPath);
          if (cancelled) return;
          snapshot = updateChildren(snapshot, dirPath, children);
          setRoot(snapshot);
        } catch {
          return;
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [root, selectedFilePath, listDir]);

  // Scroll selected file into view
  useEffect(() => {
    if (!selectedFilePath || !treeContainerRef.current) return;
    const row = treeContainerRef.current.querySelector<HTMLElement>(
      `[data-file-path="${CSS.escape(selectedFilePath)}"]`
    );
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedFilePath]);

  // Watch the root folder for fs_change events so we can auto-refresh on deletions/creations.
  // Delegates the actual watch/unwatch lifecycle and event subscription to useDirWatch;
  // this hook only owns the refresh-trigger policy (which change kinds matter, when to skip).
  const handleFsChange = useCallback(
    (event: FsChangeEvent) => {
      const changed = event.path;
      const kind = event.kind;

      // Check if the changed path is within our watched folder
      if (!root || !changed.startsWith(root.path)) {
        return;
      }

      // Ignore if we're currently searching
      if (isSearching) {
        return;
      }

      // Handle file/folder removal or creation - trigger refresh
      if (kind === 'remove' || kind === 'create') {
        // Increment refreshKey to trigger a full reload of the tree
        setRefreshKey((prev) => prev + 1);
      }
    },
    [root, isSearching]
  );

  useDirWatch(folder || null, handleFsChange);

  const activeExpanded = isSearching ? searchExpanded : expanded;
  const visibleNodes = displayRoot?.children ?? [];
  const hasSearchResults = visibleNodes.length > 0;

  return {
    treeContainerRef,
    root,
    displayRoot,
    activeExpanded,
    loadingNodes,
    loading,
    error,
    filterText,
    setFilterText,
    refreshKey,
    setRefreshKey,
    searching,
    searchError,
    isSearching,
    hasSearchResults,
    toggle,
    loadChildren,
    selectedFilePath,
  };
}
