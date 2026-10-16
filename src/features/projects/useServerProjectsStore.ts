import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/bindings/v2';
import {
  archiveThread,
  createProject,
  deleteProject,
  importProject,
  listProjects,
  listThreads,
  moveProject,
  updateProject,
} from '@/services/apiAdapt';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import {
  importKey,
  mirrorPaths,
  normalizePath,
  planProjectImports,
  projectNameFromPath,
  rootsWith,
  rootsWithout,
  rootsWithPrimary,
  toRoots,
} from './projectModel';

/**
 * `idle` before the first load, `ready` once `project/list` answered,
 * `unsupported` when the server has no project store (no sqlite state DB), and
 * `error` for a transient failure such as the app-server still starting.
 */
export type ServerProjectsStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

interface ServerProjectsStore {
  projects: Project[];
  status: ServerProjectsStatus;
  /** Bumped when thread-to-project assignments change so thread lists reload. */
  threadsVersion: number;
  refresh: () => Promise<void>;
  bumpThreads: () => void;
  /**
   * Import local cwd projects the server does not know yet; returns the paths
   * handled. Startup imports skip paths offered before; `interactive` ones are
   * folders the user just added, which may re-create a previously deleted project.
   */
  importPaths: (paths: string[], options?: { interactive?: boolean }) => Promise<string[]>;
  create: (name: string, paths: string[]) => Promise<Project>;
  rename: (projectId: string, name: string) => Promise<void>;
  addRoot: (project: Project, path: string) => Promise<void>;
  removeRoot: (project: Project, path: string) => Promise<void>;
  makePrimary: (project: Project, path: string) => Promise<void>;
  moveBefore: (projectId: string, beforeProjectId: string | null) => Promise<void>;
  remove: (projectId: string) => Promise<void>;
  /** Archives every non-archived thread in the project; resolves with the count. */
  archiveChats: (projectId: string) => Promise<number>;
}

/**
 * Local cwd projects already offered to the server. The first-run import skips
 * them, so a project deleted on another client is not silently recreated from
 * this machine's old project list.
 */
export const useImportedPathsStore = create<{
  imported: string[];
  markImported: (paths: string[]) => void;
}>()(
  persist(
    (set) => ({
      imported: [],
      markImported: (paths) =>
        set((state) => ({
          imported: [...new Set([...state.imported, ...paths.map(normalizePath)])],
        })),
    }),
    { name: 'server-projects-imported', version: 1 }
  )
);

const PAGE_LIMIT = 100;
/** Paths being imported right now; kept in the cwd mirror so they do not flicker away. */
const pendingImports = new Set<string>();

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isUnsupportedError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  return text.includes('unavailable without sqlite') || text.includes('method not found');
}

async function fetchAllProjects(): Promise<Project[]> {
  const projects: Project[] = [];
  let cursor: string | null = null;
  do {
    const page: Awaited<ReturnType<typeof listProjects>> = await listProjects({
      cursor,
      limit: PAGE_LIMIT,
    });
    projects.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return projects;
}

/** Ids of unassigned threads started in `cwd`, so an import can adopt them. */
async function unassignedThreadIds(cwd: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const page: Awaited<ReturnType<typeof listThreads>> = await listThreads({
      cursor,
      limit: PAGE_LIMIT,
      cwd,
      projectId: null,
      useStateDbOnly: true,
    });
    ids.push(...page.data.map((thread) => thread.id));
    cursor = page.nextCursor;
  } while (cursor);
  return [...new Set(ids)];
}

function syncWorkspaceMirror(projects: Project[]) {
  const { projects: current, setProjects } = useWorkspaceStore.getState();
  // Server projects win. A local path survives only while it is still waiting
  // for its import (never offered, or in flight); once offered, its absence
  // from the server means it was deleted there.
  const offered = new Set(useImportedPathsStore.getState().imported);
  const unsynced = planProjectImports(current, projects).filter(
    (path) => pendingImports.has(path) || !offered.has(path)
  );
  const next = [...new Set([...mirrorPaths(projects), ...unsynced])];
  if (next.length === current.length && next.every((p, i) => p === current[i])) return;
  setProjects(next);
}

export const useServerProjectsStore = create<ServerProjectsStore>((set, get) => {
  const mutate = async (run: () => Promise<unknown>) => {
    await run();
    await get().refresh();
  };

  return {
    projects: [],
    status: 'idle',
    threadsVersion: 0,

    refresh: async () => {
      if (get().status === 'idle' || get().status === 'error') set({ status: 'loading' });
      try {
        const projects = await fetchAllProjects();
        set({ projects, status: 'ready' });
        syncWorkspaceMirror(projects);
      } catch (error) {
        if (isUnsupportedError(error)) set({ projects: [], status: 'unsupported' });
        else set({ status: get().projects.length > 0 ? 'ready' : 'error' });
        console.debug('[projects] project/list failed:', errorText(error));
      }
    },

    bumpThreads: () => set((state) => ({ threadsVersion: state.threadsVersion + 1 })),

    importPaths: async (paths, options) => {
      const interactive = options?.interactive ?? false;
      const offered = new Set(useImportedPathsStore.getState().imported);
      const todo = planProjectImports(paths, get().projects).filter(
        (p) => !pendingImports.has(p) && (interactive || !offered.has(p))
      );
      const handled: string[] = [];
      for (const path of todo) pendingImports.add(path);
      try {
        for (const path of todo) {
          const base = { name: projectNameFromPath(path), roots: toRoots([path]) };
          try {
            let threads: string[] = [];
            try {
              threads = await unassignedThreadIds(path);
            } catch (error) {
              console.debug('[projects] could not list threads to adopt:', errorText(error));
            }
            await importProject({
              ...base,
              threads: threads.length > 0 ? threads : null,
              idempotencyKey: importKey(path),
            });
            handled.push(path);
          } catch (error) {
            // Adopting threads is best effort, and a deleted project's key
            // cannot be reused; a fresh key still creates the project.
            try {
              await createProject({
                ...base,
                idempotencyKey: `codexia:create:${crypto.randomUUID()}`,
              });
              handled.push(path);
            } catch (createError) {
              console.debug(
                '[projects] import failed:',
                path,
                errorText(error),
                errorText(createError)
              );
            }
          }
        }
      } finally {
        for (const path of todo) pendingImports.delete(path);
      }
      useImportedPathsStore.getState().markImported(handled);
      if (todo.length > 0) await get().refresh();
      return handled;
    },

    create: async (name, paths) => {
      const response = await createProject({
        name,
        roots: toRoots(paths.map(normalizePath)),
        idempotencyKey: `codexia:create:${crypto.randomUUID()}`,
      });
      await get().refresh();
      return response.project;
    },

    rename: (projectId, name) => mutate(() => updateProject({ projectId, name })),

    addRoot: (project, path) =>
      mutate(() =>
        updateProject({ projectId: project.id, roots: toRoots(rootsWith(project, path)) })
      ),

    removeRoot: (project, path) =>
      mutate(() =>
        updateProject({ projectId: project.id, roots: toRoots(rootsWithout(project, path)) })
      ),

    makePrimary: (project, path) =>
      mutate(() =>
        updateProject({ projectId: project.id, roots: toRoots(rootsWithPrimary(project, path)) })
      ),

    moveBefore: (projectId, beforeProjectId) =>
      mutate(() => moveProject({ projectId, beforeProjectId })),

    remove: async (projectId) => {
      await deleteProject({ projectId });
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        threadsVersion: state.threadsVersion + 1,
      }));
      await get().refresh();
    },

    archiveChats: async (projectId) => {
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        const page: Awaited<ReturnType<typeof listThreads>> = await listThreads({
          cursor,
          limit: PAGE_LIMIT,
          projectId,
          useStateDbOnly: true,
        });
        ids.push(...page.data.map((thread) => thread.id));
        cursor = page.nextCursor;
      } while (cursor);
      let archived = 0;
      try {
        for (const id of ids) {
          await archiveThread(id);
          archived += 1;
        }
      } finally {
        get().bumpThreads();
      }
      return archived;
    },
  };
});
