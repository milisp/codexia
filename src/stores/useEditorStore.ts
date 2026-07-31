import { create } from 'zustand';

interface EditorStore {
  openFiles: string[];
  activeFile: string | null;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  /** @deprecated use openFile / activeFile */
  selectedFilePath: string | null;
  /** @deprecated use openFile */
  setSelectedFilePath: (path: string | null) => void;
  hasConfirmedGitRevert: boolean;
  setHasConfirmedGitRevert: (value: boolean) => void;
  resetFiles: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  openFiles: [],
  activeFile: null,
  openFile: (path) =>
    set((state) => ({
      openFiles: state.openFiles.includes(path) ? state.openFiles : [...state.openFiles, path],
      activeFile: path,
      selectedFilePath: path,
    })),
  closeFile: (path) =>
    set((state) => {
      const next = state.openFiles.filter((f) => f !== path);
      const activeFile =
        state.activeFile === path
          ? (next[next.indexOf(path) - 1] ?? next[0] ?? null)
          : state.activeFile;
      return { openFiles: next, activeFile, selectedFilePath: activeFile };
    }),
  setActiveFile: (path) => set({ activeFile: path, selectedFilePath: path }),
  // Deprecated shims — keep for backward compat
  selectedFilePath: null,
  setSelectedFilePath: (path) =>
    set((state) => ({
      selectedFilePath: path,
      activeFile: path,
      openFiles:
        path && !state.openFiles.includes(path) ? [...state.openFiles, path] : state.openFiles,
    })),
  hasConfirmedGitRevert: false,
  setHasConfirmedGitRevert: (value) => set({ hasConfirmedGitRevert: value }),
  resetFiles: () => set({ openFiles: [], activeFile: null, selectedFilePath: null }),
}));
