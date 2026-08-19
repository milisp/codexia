import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInputStore } from '@/stores/useInputStore';
import { type Todo, useTodoStore } from '@/stores/useTodoStore';
import { TodoItemRow } from './TodoItemRow';
import { useTodoSelection } from './useTodoSelection';

type TodoListProps = {
  todos: Todo[];
  isFiltered: boolean;
};

export function TodoList({ todos, isFiltered }: TodoListProps) {
  const categories = useTodoStore((state) => state.categories);
  const setDone = useTodoStore((state) => state.setDone);
  const setPinned = useTodoStore((state) => state.setPinned);
  const moveTodos = useTodoStore((state) => state.moveTodos);
  const updateText = useTodoStore((state) => state.updateText);
  const removeTodos = useTodoStore((state) => state.removeTodos);
  const appendInputValue = useInputStore((state) => state.appendInputValue);
  const { selectedIds, handleRowClick, targetsFor, clear } = useTodoSelection(todos);

  const idsOf = (targets: Todo[]) => targets.map((todo) => todo.id);

  // appendInputValue already routes to whichever composer is active.
  const sendToComposer = (targets: Todo[]) => {
    const text =
      targets.length === 1 ? targets[0].text : targets.map((todo) => `- ${todo.text}`).join('\n');
    appendInputValue(text);
    setDone(idsOf(targets), true);
    toast.success(targets.length === 1 ? 'Sent to composer' : `Sent ${targets.length} to composer`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar/5">
      {selectedIds.length > 1 ? (
        <div className="flex items-center justify-between px-3 py-1 text-[10px] text-muted-foreground">
          <span>{selectedIds.length} selected</span>
          <button type="button" className="hover:text-foreground" onClick={clear}>
            Clear
          </button>
        </div>
      ) : null}
      <ScrollArea className="h-full">
        <div className="px-2 pb-4">
          {todos.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              {isFiltered ? (
                <div>No todos matching filter</div>
              ) : (
                <div className="space-y-1">
                  <div>No todos yet</div>
                  <div>
                    Select text in a message and tap{' '}
                    <kbd className="rounded border px-1 py-0.5 font-mono text-[10px]">Shift</kbd>{' '}
                    twice to capture it.
                  </div>
                </div>
              )}
            </div>
          ) : (
            todos.map((todo) => {
              const targets = targetsFor(todo);
              return (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  categories={categories}
                  targets={targets}
                  isSelected={selectedIds.includes(todo.id)}
                  onRowClick={(event) => handleRowClick(todo.id, event)}
                  onToggleDone={(done) => setDone(idsOf(targets), done)}
                  onPin={(pinned) => setPinned(idsOf(targets), pinned)}
                  onMove={(categoryId) => moveTodos(idsOf(targets), categoryId)}
                  onTextChange={(text) => updateText(todo.id, text)}
                  onRemove={() => removeTodos(idsOf(targets))}
                  onSendToComposer={() => sendToComposer(targets)}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
