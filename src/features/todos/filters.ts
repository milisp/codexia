import type { Todo, TodoCategory } from '@/stores/useTodoStore';

/** Finds a category by name, case-insensitively. */
export function findCategoryByName(
  categories: TodoCategory[],
  name: string
): TodoCategory | undefined {
  const wanted = name.trim().toLowerCase();
  return categories.find((c) => c.name.trim().toLowerCase() === wanted);
}

/**
 * Pinned first, done last, oldest first within each group — the order plux
 * settled on, so a captured todo lands at the bottom where it was typed.
 */
export function filterTodos(
  todos: Todo[],
  categoryId: string | null,
  searchText: string,
  hideDone: boolean
): Todo[] {
  const scoped = categoryId === null ? todos : todos.filter((t) => t.categoryId === categoryId);
  const visible = hideDone ? scoped.filter((t) => !t.isDone) : scoped;
  const lowerSearch = searchText.trim().toLowerCase();
  const base = lowerSearch
    ? visible.filter((t) => t.text.toLowerCase().includes(lowerSearch))
    : visible;

  return [...base].sort((a, b) => {
    const aPinned = a.pinnedAt != null;
    const bPinned = b.pinnedAt != null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    return a.createdAt - b.createdAt;
  });
}

export function countTodosByCategory(todos: Todo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const todo of todos) {
    if (todo.isDone || !todo.categoryId) continue;
    counts[todo.categoryId] = (counts[todo.categoryId] ?? 0) + 1;
  }
  return counts;
}
