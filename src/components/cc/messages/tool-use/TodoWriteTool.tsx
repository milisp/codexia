import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ToolResultBlock, ToolUseBlock } from '../../types/messages';
import { CCTodoList } from '../CCTodoList';

interface Props {
  block: ToolUseBlock;
  inlineError?: ToolResultBlock | null;
  showError: boolean;
  onToggleError: () => void;
}

export function TodoWriteTool({ block, inlineError, showError, onToggleError }: Props) {
  return (
    <>
      <div className="flex items-center flex-wrap gap-0.5">
        <Badge
          variant="secondary"
          className="text-[10px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-none"
        >
          TodoWrite
        </Badge>
        {inlineError && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleError}
            className="h-4 w-4 text-red-500 hover:text-red-600"
          >
            {showError ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        )}
      </div>
      {block.input.todos && <CCTodoList todos={block.input.todos} />}
      {inlineError && showError && (
        <div className="mt-1 text-xs whitespace-pre-wrap break-words text-red-600 dark:text-red-400 border-t border-red-500/20 pt-1">
          {typeof inlineError.content === 'string'
            ? inlineError.content
            : JSON.stringify(inlineError.content)}
        </div>
      )}
    </>
  );
}
