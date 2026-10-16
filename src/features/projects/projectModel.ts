import type { Project, ProjectRoot, Thread } from '@/bindings/v2';

/**
 * Pure helpers over app-server projects (`project/*`).
 *
 * The protocol has no "primary root" field: roots are an ordered list and
 * Codexia treats the first one as primary. New chats in a project start there,
 * and "Make primary" reorders the list via `project/update`.
 */

/** Trim and drop a trailing separator so `/a/b/` and `/a/b` compare equal. */
export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length > 1 && /[\\/]$/.test(trimmed)) return trimmed.replace(/[\\/]+$/, '');
  return trimmed;
}

export function rootPaths(project: Project): string[] {
  return project.roots.map((root) => root.path);
}

export function primaryRoot(project: Project): string | null {
  return project.roots[0]?.path ?? null;
}

export function toRoots(paths: string[]): ProjectRoot[] {
  return paths.map((path) => ({ path }));
}

/** Roots reordered so `path` comes first; unchanged when it is not a root. */
export function rootsWithPrimary(project: Project, path: string): string[] {
  const paths = rootPaths(project);
  if (!paths.includes(path)) return paths;
  return [path, ...paths.filter((p) => p !== path)];
}

export function rootsWithout(project: Project, path: string): string[] {
  return rootPaths(project).filter((p) => p !== path);
}

/** Roots with `path` appended; unchanged when already attached. */
export function rootsWith(project: Project, path: string): string[] {
  const paths = rootPaths(project);
  const normalized = normalizePath(path);
  if (!normalized || paths.some((p) => normalizePath(p) === normalized)) return paths;
  return [...paths, normalized];
}

const isUnder = (cwd: string, root: string): boolean =>
  cwd === root || cwd.startsWith(`${root}/`) || cwd.startsWith(`${root}\\`);

/**
 * The project a working directory belongs to: an exact primary root wins, then
 * any exact root, then the deepest root containing the directory.
 */
export function findProjectForCwd(
  projects: Project[],
  cwd: string | null | undefined
): Project | null {
  const target = cwd ? normalizePath(cwd) : '';
  if (!target) return null;
  const exactPrimary = projects.find((p) => {
    const primary = primaryRoot(p);
    return primary !== null && normalizePath(primary) === target;
  });
  if (exactPrimary) return exactPrimary;
  const exact = projects.find((p) => rootPaths(p).some((r) => normalizePath(r) === target));
  if (exact) return exact;
  let best: { project: Project; length: number } | null = null;
  for (const project of projects) {
    for (const root of rootPaths(project)) {
      const normalized = normalizePath(root);
      if (
        normalized.length > 1 &&
        isUnder(target, normalized) &&
        normalized.length > (best?.length ?? 0)
      ) {
        best = { project, length: normalized.length };
      }
    }
  }
  return best?.project ?? null;
}

/** Primary roots in server order: the cwd list the rest of the app consumes. */
export function mirrorPaths(projects: Project[]): string[] {
  const paths: string[] = [];
  for (const project of projects) {
    const primary = primaryRoot(project);
    if (primary && !paths.includes(primary)) paths.push(primary);
  }
  return paths;
}

/** Local cwd projects that no server project has as a root yet. */
export function planProjectImports(localPaths: string[], projects: Project[]): string[] {
  const attached = new Set(projects.flatMap(rootPaths).map(normalizePath));
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const raw of localPaths) {
    const path = normalizePath(raw);
    if (!path || attached.has(path) || seen.has(path)) continue;
    seen.add(path);
    missing.push(path);
  }
  return missing;
}

/**
 * Deterministic per path: the server replays an import with the same key
 * instead of creating a second project, so a retry or a second window cannot
 * duplicate it.
 */
export function importKey(path: string): string {
  return `codexia:import:${normalizePath(path)}`;
}

export function projectNameFromPath(path: string): string {
  const parts = normalizePath(path).replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Whether a thread belongs to a sidebar scope: a project id, or `null` for "Recent". */
export function threadInScope(
  thread: Pick<Thread, 'projectId'>,
  projectId: string | null
): boolean {
  return (thread.projectId ?? null) === projectId;
}

/** Splits threads into per-project buckets; unassigned or unknown-project ones are recent. */
export function groupThreadsByProject<T extends Pick<Thread, 'projectId'>>(
  threads: T[],
  projects: Project[]
): { byProject: Map<string, T[]>; recent: T[] } {
  const byProject = new Map<string, T[]>(projects.map((p) => [p.id, []]));
  const recent: T[] = [];
  for (const thread of threads) {
    const bucket = thread.projectId ? byProject.get(thread.projectId) : undefined;
    if (bucket) bucket.push(thread);
    else recent.push(thread);
  }
  return { byProject, recent };
}
