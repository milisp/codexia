import { CheckCircle2, Circle, CornerUpLeft, Pin } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Todo, TodoCategory } from '@/stores/useTodoStore';
import { TodoContextMenu } from './TodoContextMenu';

type TodoItemRowProps = {
  todo: Todo;
  categories: TodoCategory[];
  /** Everything an action on this row applies to — the selection, or this row. */
  targets: Todo[];
  isSelected: boolean;
  onRowClick: (event: MouseEvent) => void;
  onToggleDone: (done: boolean) => void;
  onPin: (pinned: boolean) => void;
  onMove: (categoryId: string | null) => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
  onSendToComposer: () => void;
};

export function TodoItemRow({
  todo,
  categories,
  targets,
  isSelected,
  onRowClick,
  onToggleDone,
  onPin,
  onMove,
  onTextChange,
  onRemove,
  onSendToComposer,
}: TodoItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);

  useEffect(() => {
    if (!isEditing) return;
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [isEditing]);

  const startEdit = () => {
    setDraft(todo.text);
    setIsEditing(true);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  };

  const commit = () => {
    onTextChange(draft);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setDraft(todo.text);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-start gap-2 rounded-md px-2 py-2">
        <span className="mt-0.5 shrink-0">
          <Circle className="size-4 text-muted-foreground" />
        </span>
        <textarea
          ref={inputRef}
          className="min-h-0 max-h-60 flex-1 resize-none overflow-y-auto border-none bg-transparent p-0 text-sm outline-none"
          value={draft}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={() => {
            setTimeout(() => {
              isComposing.current = false;
            }, 50);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !isComposing.current &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancelEdit();
            }
          }}
        />
      </div>
    );
  }

  return (
    <TodoContextMenu
      targets={targets}
      categories={categories}
      isExpanded={isExpanded}
      onToggleDone={onToggleDone}
      onPin={onPin}
      onMove={onMove}
      onToggleExpand={() => setIsExpanded((value) => !value)}
      onEdit={startEdit}
      onDelete={onRemove}
      onSendToComposer={onSendToComposer}
    >
      <div
        role="option"
        aria-selected={isSelected}
        tabIndex={0}
        className={cn(
          'group flex items-start gap-2 rounded-md px-2 py-2 outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isSelected ? 'bg-accent' : 'hover:bg-accent/40'
        )}
        onClick={onRowClick}
        onDoubleClick={startEdit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            // Only the modifier flags are read, and a keyboard event carries
            // the same ones — so Shift/Cmd+Enter extend the selection too.
            onRowClick(event as unknown as MouseEvent);
          } else if (event.key === ' ') {
            event.preventDefault();
            onToggleDone(!todo.isDone);
          }
        }}
      >
        <button
          type="button"
          className="mt-0.5 shrink-0 transition-transform active:scale-90"
          onClick={(event) => {
            event.stopPropagation();
            onToggleDone(!todo.isDone);
          }}
          title={todo.isDone ? 'Mark as not done' : 'Mark as done'}
        >
          {todo.isDone ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <Circle className="size-4 text-muted-foreground" />
          )}
        </button>

        {todo.pinnedAt != null ? (
          <Pin className="mt-0.5 size-3.5 shrink-0 fill-amber-500 text-amber-500" />
        ) : null}

        <span
          className={cn(
            'min-w-0 flex-1 cursor-default select-none break-words text-left text-sm',
            isExpanded ? 'block h-auto whitespace-pre-wrap' : 'line-clamp-2 whitespace-normal',
            todo.isDone ? 'text-muted-foreground line-through' : 'text-foreground'
          )}
        >
          {todo.text}
        </span>

        <button
          type="button"
          className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onSendToComposer();
          }}
          title="Send to composer"
        >
          <CornerUpLeft className="size-3.5" />
        </button>
      </div>
    </TodoContextMenu>
  );
}
