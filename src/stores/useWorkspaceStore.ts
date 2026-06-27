import { create } from 'zustand';

export type AgentType = 'codex' | 'cc';
export const AGENT_TYPES: AgentType[] = ['cc', 'codex'];
export type ProjectSortKey = 'added_desc' | 'added_asc' | 'name_asc' | 'name_desc';
const MAX_HISTORY_PROJECTS = 30;

function normalizeProjectPath(project: string): string {
  return project.trim();
}

function dedupeProjects(projects: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const project of projects) {
    const normalized = normalizeProjectPath(project);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function pushRecentProject(history: string[], project: string | null): string[] {
  if (!project) {
    return history;
  }
  const normalized = normalizeProjectPath(project);
  if (!normalized) {
    return history;
  }
  const withoutCurrent = history.filter((item) => item !== normalized);
  return [normalized, ...withoutCurrent].slice(0, MAX_HISTORY_PROJECTS);
}

export function sortProjects(projects: string[], sortKey: ProjectSortKey): string[] {
  const next = [...projects];
  if (sortKey === 'added_desc') {
    return next.reverse();
  }
  if (sortKey === 'added_asc') {
    return next;
  }
  return next.sort((a, b) =>
    sortKey === 'name_asc'
      ? a.localeCompare(b, undefined, { sensitivity: 'base' })
      : b.localeCompare(a, undefined, { sensitivity: 'base' })
  );
}

interface WorkspaceStore {
  selectedAgent: AgentType;
  setSelectedAgent: (agent: AgentType) => void;
  projects: string[];
  setProjects: (projects: string[]) => void;
  addProject: (project: string) => void;
  removeProject: (project: string) => void;
  addProjectAndSelect: (project: string) => void;
  historyProjects: string[];
  setHistoryProjects: (projects: string[]) => void;
  addHistoryProject: (project: string) => void;
  clearHistoryProjects: () => void;
  projectSort: ProjectSortKey;
  setProjectSort: (sortKey: ProjectSortKey) => void;
  historyMode: boolean;
  setHistoryMode: (historyMode: boolean) => void;
  cwd: string | null;
  setCwd: (path: string | null) => void;
  // Multi-file tab state
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
  instructionType: string;
  setInstructionType: (type: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  selectedAgent: 'codex',
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  projects: [],
  setProjects: (projects) => set({ projects: dedupeProjects(projects) }),
  addProject: (project) =>
    set((state) => {
      const normalized = normalizeProjectPath(project);
      if (!normalized) {
        return state;
      }
      return {
        projects: state.projects.includes(normalized)
          ? state.projects
          : [...state.projects, normalized],
        historyProjects: pushRecentProject(state.historyProjects, normalized),
      };
    }),
  removeProject: (project) =>
    set((state) => {
      const normalized = normalizeProjectPath(project);
      const projects = state.projects.filter((p) => p !== normalized);
      const shouldClearCwd = state.cwd === normalized;
      const nextCwd = shouldClearCwd ? (projects[0] ?? null) : state.cwd;

      return {
        projects,
        cwd: nextCwd,
        openFiles: shouldClearCwd ? [] : state.openFiles,
        activeFile: shouldClearCwd ? null : state.activeFile,
        selectedFilePath: shouldClearCwd ? null : state.selectedFilePath,
      };
    }),
  addProjectAndSelect: (project) => {
    const trimmed = normalizeProjectPath(project);
    const state = get();
    if (trimmed && !state.projects.includes(trimmed)) {
      set({
        projects: [...state.projects, trimmed],
        cwd: trimmed,
        historyProjects: pushRecentProject(state.historyProjects, trimmed),
      });
    }
  },
  historyProjects: [],
  setHistoryProjects: (projects) => set({ historyProjects: dedupeProjects(projects) }),
  addHistoryProject: (project) =>
    set((state) => ({
      historyProjects: pushRecentProject(state.historyProjects, project),
    })),
  clearHistoryProjects: () => set({ historyProjects: [] }),
  projectSort: 'added_desc',
  setProjectSort: (sortKey) => set({ projectSort: sortKey }),
  historyMode: false,
  setHistoryMode: (historyMode) => set({ historyMode }),
  cwd: null,
  setCwd: (path) => {
    const normalized = path ? normalizeProjectPath(path) : null;
    set((state) => ({
      cwd: normalized,
      openFiles: [],
      activeFile: null,
      selectedFilePath: null,
      historyProjects: normalized
        ? pushRecentProject(state.historyProjects, normalized)
        : state.historyProjects,
    }));
  },
  // Multi-file tab state
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
  instructionType: 'system',
  setInstructionType: (type) => set({ instructionType: type }),
}));
