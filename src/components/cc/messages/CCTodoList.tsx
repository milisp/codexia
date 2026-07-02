import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface TodoItem {
  activeForm: string;
  content: string;
  status: 'completed' | 'in_progress' | 'pending';
}

interface Props {
  todos: TodoItem[];
}

export function CCTodoList({ todos }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const visible = todos.filter((t) => t.status !== 'completed' || showCompleted);

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {visible.map((todo, idx) => (
        <div
          key={todo.content + idx}
          className={cn(
            'flex items-center gap-2 rounded px-2 py-1',
            todo.status === 'in_progress' ? 'text-blue-700 dark:text-blue-300' : 'opacity-40'
          )}
        >
          <div className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
            {todo.status === 'completed' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : todo.status === 'in_progress' ? (
              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
          </div>
          <span
            className={cn('min-w-0 flex-1 text-xs', todo.status === 'completed' && 'line-through')}
          >
            {todo.status === 'in_progress' ? todo.activeForm || todo.content : todo.content}
          </span>
        </div>
      ))}

      {completedCount > 0 && (
        <button
          onClick={() => setShowCompleted((v) => !v)}
          className="self-start px-2 py-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {showCompleted ? 'Hide completed' : `${completedCount} completed`}
        </button>
      )}
    </div>
  );
}
