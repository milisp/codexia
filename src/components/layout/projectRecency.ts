import type { Project } from '@/bindings/v2';

/** Projects shown before the sidebar's "Show more". */
export const RECENT_PROJECT_LIMIT = 5;

/** Orders paths by `history` (most recent first); paths without history keep their order after. */
export function sortByRecentUse(projects: string[], history: string[]): string[] {
  const rank = new Map(history.map((path, i) => [path, i]));
  return projects
    .map((path, i) => ({ path, i, r: rank.get(path) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ path }) => path);
}

/** Orders app-server projects by their newest chat; projects without chats keep their order after. */
export function sortByRecency(projects: Project[]): Project[] {
  return projects
    .map((project, i) => ({ project, i }))
    .sort(
      (a, b) =>
        (b.project.recencyAt ?? Number.NEGATIVE_INFINITY) -
          (a.project.recencyAt ?? Number.NEGATIVE_INFINITY) || a.i - b.i
    )
    .map(({ project }) => project);
}
