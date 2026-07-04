import { ChevronDown, ChevronRight, FileCode, Folder, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ToolResultBlock, ToolUseBlock } from '../../../types/messages';

interface Props {
  block: ToolUseBlock;
  inlineError?: ToolResultBlock | null;
  showError: boolean;
  onToggleError: () => void;
}

export function GrepTool({ block, inlineError, showError, onToggleError }: Props) {
  return (
    <>
      <div className="flex items-center flex-wrap gap-0.5">
        <Badge
          variant="secondary"
          className="text-[10px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-none"
        >
          Grep
        </Badge>
        <span className="flex items-center gap-0.5">
          <Badge variant="outline">
            <Search className="h-3 w-3" />
            {block.input?.pattern}
          </Badge>
          in
          <Badge variant="outline">
            <Folder className="h-3 w-3" />
            {block.input?.path}
          </Badge>
          {block.input?.glob && (
            <Badge variant="outline">
              <FileCode className="h-3 w-3" />
              {block.input.glob}
            </Badge>
          )}
        </span>
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
