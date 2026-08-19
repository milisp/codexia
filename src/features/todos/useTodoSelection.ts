import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Todo } from '@/stores/useTodoStore';

/**
 * List selection with the modifiers people already expect: plain click picks
 * one, Cmd/Ctrl toggles, Shift takes the range from the last click.
 *
 * `todos` must be in display order — a Shift-range is defined by what the user
 * sees, not by insertion order.
 */
export function useTodoSelection(todos: Todo[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const anchorRef = useRef<string | null>(null);

  // A todo that got deleted or filtered away must not stay selected, or a
  // batch action would silently act on rows that are no longer on screen.
  useEffect(() => {
    setSelectedIds((current) => {
      const visible = current.filter((id) => todos.some((todo) => todo.id === id));
      return visible.length === current.length ? current : visible;
    });
  }, [todos]);

  const clear = useCallback(() => {
    setSelectedIds([]);
    anchorRef.current = null;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clear]);

  const handleRowClick = useCallback(
    (todoId: string, event: MouseEvent) => {
      if (event.shiftKey && anchorRef.current) {
        const from = todos.findIndex((todo) => todo.id === anchorRef.current);
        const to = todos.findIndex((todo) => todo.id === todoId);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelectedIds(todos.slice(start, end + 1).map((todo) => todo.id));
          return;
        }
      }

      if (event.metaKey || event.ctrlKey) {
        setSelectedIds((current) =>
          current.includes(todoId) ? current.filter((id) => id !== todoId) : [...current, todoId]
        );
        anchorRef.current = todoId;
        return;
      }

      // A plain click on the only selected row deselects it, so clicking twice
      // is always a way back out of selection mode.
      setSelectedIds((current) => (current.length === 1 && current[0] === todoId ? [] : [todoId]));
      anchorRef.current = todoId;
    },
    [todos]
  );

  /** What an action on this row applies to: the selection, or just the row. */
  const targetsFor = useCallback(
    (todo: Todo): Todo[] =>
      selectedIds.includes(todo.id) ? todos.filter((t) => selectedIds.includes(t.id)) : [todo],
    [selectedIds, todos]
  );

  return { selectedIds, handleRowClick, targetsFor, clear };
}
