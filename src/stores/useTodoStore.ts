import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Todo {
  id: string;
  text: string;
  isDone: boolean;
  createdAt: number;
  categoryId: string | null;
  pinnedAt: number | null;
}

export interface TodoCategory {
  id: string;
  name: string;
}

interface TodoStore {
  todos: Todo[];
  categories: TodoCategory[];
  addTodo: (text: string, categoryId?: string | null) => string | null;
  toggleDone: (id: string) => void;
  setDone: (ids: string[], done: boolean) => void;
  setPinned: (ids: string[], pinned: boolean) => void;
  moveTodos: (ids: string[], categoryId: string | null) => void;
  updateText: (id: string, text: string) => void;
  removeTodos: (ids: string[]) => void;
  clearCompleted: () => void;
  addCategory: (name: string) => string | null;
  renameCategory: (id: string, name: string) => void;
  removeCategory: (id: string) => void;
  upsellDismissed: boolean;
  dismissUpsell: () => void;
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set) => ({
      todos: [],
      categories: [],
      upsellDismissed: false,
      dismissUpsell: () => set({ upsellDismissed: true }),

      addTodo: (text, categoryId = null) => {
        const trimmed = text.trim();
        if (!trimmed) return null;
        const id = uuidv4();
        set((state) => ({
          todos: [
            ...state.todos,
            {
              id,
              text: trimmed,
              isDone: false,
              createdAt: Date.now(),
              categoryId,
              pinnedAt: null,
            },
          ],
        }));
        return id;
      },

      toggleDone: (id) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, isDone: !todo.isDone } : todo
          ),
        })),

      setDone: (ids, done) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            ids.includes(todo.id) ? { ...todo, isDone: done } : todo
          ),
        })),

      setPinned: (ids, pinned) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            ids.includes(todo.id) ? { ...todo, pinnedAt: pinned ? Date.now() : null } : todo
          ),
        })),

      moveTodos: (ids, categoryId) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            ids.includes(todo.id) ? { ...todo, categoryId } : todo
          ),
        })),

      updateText: (id, text) =>
        set((state) => ({
          todos: state.todos.map((todo) => (todo.id === id ? { ...todo, text } : todo)),
        })),

      removeTodos: (ids) =>
        set((state) => ({ todos: state.todos.filter((todo) => !ids.includes(todo.id)) })),

      clearCompleted: () => set((state) => ({ todos: state.todos.filter((t) => !t.isDone) })),

      addCategory: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const id = uuidv4();
        set((state) => ({ categories: [...state.categories, { id, name: trimmed }] }));
        return id;
      },

      renameCategory: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
        }));
      },

      // Deleting a category never deletes its todos — they fall back to uncategorized.
      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          todos: state.todos.map((todo) =>
            todo.categoryId === id ? { ...todo, categoryId: null } : todo
          ),
        })),
    }),
    {
      name: 'todo-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2 && persistedState) {
          persistedState.categories = persistedState.categories ?? [];
          if (Array.isArray(persistedState.todos)) {
            // v1 todos had neither field, so these defaults never clobber data.
            persistedState.todos = persistedState.todos.map((todo: Todo) => ({
              ...todo,
              categoryId: todo.categoryId ?? null,
              pinnedAt: todo.pinnedAt ?? null,
            }));
          }
        }
        return persistedState;
      },
    }
  )
);
