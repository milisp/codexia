import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTodoStore } from '@/stores/useTodoStore';
import { CategorySection } from './CategorySection';
import { countTodosByCategory, filterTodos, findCategoryByName } from './filters';
import { PluxUpsellLine } from './PluxUpsellLine';
import { TodoInputBar } from './TodoInputBar';
import { TodoList } from './TodoList';

export default function TodoView() {
  const todos = useTodoStore((state) => state.todos);
  const categories = useTodoStore((state) => state.categories);
  const addTodo = useTodoStore((state) => state.addTodo);
  const addCategory = useTodoStore((state) => state.addCategory);
  const renameCategory = useTodoStore((state) => state.renameCategory);
  const removeCategory = useTodoStore((state) => state.removeCategory);
  const clearCompleted = useTodoStore((state) => state.clearCompleted);

  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);

  const visibleTodos = useMemo(
    () => filterTodos(todos, selectedCategoryId, search, hideDone),
    [todos, selectedCategoryId, search, hideDone]
  );
  const todoCounts = useMemo(() => countTodosByCategory(todos), [todos]);
  const hasCompleted = todos.some((todo) => todo.isDone);

  const handleSubmit = useCallback(
    (text: string, categoryName: string | null) => {
      // `#tag` files the todo: an existing category by that name, or a new one.
      let categoryId = selectedCategoryId;
      if (categoryName) {
        categoryId =
          findCategoryByName(useTodoStore.getState().categories, categoryName)?.id ??
          addCategory(categoryName);
      }
      addTodo(text, categoryId);
    },
    [addTodo, addCategory, selectedCategoryId]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="flex flex-1 min-h-0 flex-col bg-sidebar/10">
        <div className="flex items-center justify-end gap-1 px-3 py-1">
          <Button
            variant={hideDone ? 'default' : 'ghost'}
            size="sm"
            className="h-7"
            onClick={() => setHideDone((value) => !value)}
          >
            Hide done
          </Button>
          {hasCompleted ? (
            <Button variant="ghost" size="sm" className="h-7" onClick={clearCompleted}>
              Clear done
            </Button>
          ) : null}
        </div>

        <CategorySection
          categories={categories}
          todoCounts={todoCounts}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          onAddCategory={addCategory}
          onDeleteCategory={(categoryId) => {
            removeCategory(categoryId);
            if (selectedCategoryId === categoryId) setSelectedCategoryId(null);
          }}
          onRenameCategory={renameCategory}
        />

        <div className="flex-1 min-h-0 overflow-hidden border-t">
          <TodoList todos={visibleTodos} isFiltered={!!search || hideDone} />
        </div>

        <TodoInputBar
          onSubmit={handleSubmit}
          onAddCategory={addCategory}
          onSearchChange={setSearch}
        />
        <PluxUpsellLine />
      </div>
    </div>
  );
}
