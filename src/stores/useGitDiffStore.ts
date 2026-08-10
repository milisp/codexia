import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiffSection, DiffSource } from '@/features/git/types';
import { ancestorFolderPaths } from '@/features/git/utils';
import type { GitStatusResponse } from '@/services/apiAdapt';

type GitDiffState = {
  /** cwd the selection state belongs to; used to reset when the workspace changes. */
  cwdKey: string | null;
  /** Cached status so a remount renders immediately instead of flashing empty. */
  gitData: GitStatusResponse | null;
  gitError: string | null;
  showFileTree: boolean;
  diffSource: DiffSource;
  filterText: string;
  /**
   * Collapsed folders, kept per section: staged and unstaged list different
   * files, so folding one must not reshape the other.
   */
  collapsedFolders: Record<DiffSection, Set<string>>;
  /**
   * Per-file diff expansion overrides, also per section. Absent paths fall back
   * to the list's auto-expand heuristic, so only deliberate choices are stored.
   */
  expandedDiffs: Record<DiffSection, Record<string, boolean>>;
  selectedSection: DiffSection;
  selectedPath: string | null;
  /** True once the user picked a section explicitly, so auto-detection stops overriding it. */
  sectionExplicitlySelected: boolean;
  /** Last file this panel opened itself, to avoid reacting to its own tab change. */
  lastInternallyOpenedFile: string | null;

  syncCwd: (cwd: string | null) => void;
  toggleFileTree: () => void;
  setDiffSource: (source: DiffSource) => void;
  setFilterText: (text: string) => void;
  toggleFolder: (section: DiffSection, path: string) => void;
  /** Expands every folder enclosing a file so the selection is visible. */
  revealPath: (section: DiffSection, path: string) => void;
  setDiffExpanded: (section: DiffSection, path: string, expanded: boolean) => void;
  setAllDiffsExpanded: (section: DiffSection, paths: string[], expanded: boolean) => void;
  selectSection: (section: DiffSection) => void;
  selectPath: (path: string) => void;
  setLastInternallyOpenedFile: (path: string | null) => void;
  setGitData: (data: GitStatusResponse | null) => void;
  setGitError: (message: string | null) => void;
};

const selectionDefaults = {
  gitData: null,
  gitError: null,
  filterText: '',
  collapsedFolders: { staged: new Set<string>(), unstaged: new Set<string>() },
  expandedDiffs: { staged: {}, unstaged: {} },
  selectedSection: 'unstaged' as DiffSection,
  selectedPath: null,
  sectionExplicitlySelected: false,
  lastInternallyOpenedFile: null,
};

export const useGitDiffStore = create<GitDiffState>()(
  persist(
    (set, get) => ({
      cwdKey: null,
      showFileTree: true,
      diffSource: 'unstaged',
      ...selectionDefaults,

      syncCwd: (cwd) => {
        if (get().cwdKey === cwd) return;
        set({ cwdKey: cwd, ...selectionDefaults });
      },

      toggleFileTree: () => set((state) => ({ showFileTree: !state.showFileTree })),

      setDiffSource: (source) => {
        if (source === 'staged' || source === 'unstaged') {
          set({
            diffSource: source,
            selectedSection: source,
            selectedPath: null,
            sectionExplicitlySelected: true,
          });
          return;
        }
        set({ diffSource: source });
      },

      setFilterText: (text) => set({ filterText: text }),

      toggleFolder: (section, path) =>
        set((state) => {
          const next = new Set(state.collapsedFolders[section]);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return { collapsedFolders: { ...state.collapsedFolders, [section]: next } };
        }),

      revealPath: (section, path) =>
        set((state) => {
          const current = state.collapsedFolders[section];
          const ancestors = ancestorFolderPaths(path).filter((folder) => current.has(folder));
          if (ancestors.length === 0) return state;
          const next = new Set(current);
          for (const folder of ancestors) next.delete(folder);
          return { collapsedFolders: { ...state.collapsedFolders, [section]: next } };
        }),

      setDiffExpanded: (section, path, expanded) =>
        set((state) =>
          state.expandedDiffs[section][path] === expanded
            ? state
            : {
                expandedDiffs: {
                  ...state.expandedDiffs,
                  [section]: { ...state.expandedDiffs[section], [path]: expanded },
                },
              }
        ),

      setAllDiffsExpanded: (section, paths, expanded) =>
        set((state) => {
          const next = { ...state.expandedDiffs[section] };
          for (const path of paths) next[path] = expanded;
          return { expandedDiffs: { ...state.expandedDiffs, [section]: next } };
        }),

      selectSection: (section) =>
        set({
          selectedSection: section,
          selectedPath: null,
          sectionExplicitlySelected: true,
        }),

      selectPath: (path) => set({ selectedPath: path, sectionExplicitlySelected: true }),

      setLastInternallyOpenedFile: (path) => set({ lastInternallyOpenedFile: path }),

      setGitData: (data) =>
        set((state) =>
          JSON.stringify(state.gitData) === JSON.stringify(data) ? state : { gitData: data }
        ),

      setGitError: (message) => set({ gitError: message }),
    }),
    {
      name: 'git-diff-store',
      // Only the durable layout preference is persisted; selection state is
      // per-session and must not resurrect a stale path on app restart.
      partialize: (state) => ({ showFileTree: state.showFileTree }),
    }
  )
);
