import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ToolResultBlock, ToolUseBlock } from '../../../types/messages';
import { CommandValue } from '../ToolInputDisplay';

interface Props {
  block: ToolUseBlock;
  inlineError?: ToolResultBlock | null;
  showError: boolean;
  onToggleError: () => void;
}

export function BashTool({ block, inlineError, showError, onToggleError }: Props) {
  const [showCommand, setShowCommand] = useState(false);

  return (
    <>
      <div className="flex items-center flex-wrap gap-0.5">
        <Badge
          variant="secondary"
          className="text-[10px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-none"
        >
          Bash
        </Badge>
        {block.input?.description && (
          <Badge variant="outline" className="text-[10px] h-4">
            {block.input.description}
          </Badge>
        )}
        {block.input?.command && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowCommand((p) => !p)}
            className="h-4 w-4"
          >
            {showCommand ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        )}
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
      {block.input?.command && showCommand && (
        <div className="mt-2">
          <CommandValue value={block.input.command} />
        </div>
      )}
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
