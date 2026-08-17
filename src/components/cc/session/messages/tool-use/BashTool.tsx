import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { CopyButton } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import type { ToolResultBlock, ToolUseBlock } from '../../../types/messages';
import { CommandValue } from '../ToolInputDisplay';

interface Props {
  block: ToolUseBlock;
  inlineError?: ToolResultBlock | null;
}

export function BashTool({ block, inlineError }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const command: string = block.input?.command ?? '';
  const errorText = inlineError
    ? typeof inlineError.content === 'string'
      ? inlineError.content
      : JSON.stringify(inlineError.content)
    : null;

  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex gap-2 items-center text-sm font-mono text-muted-foreground hover:text-foreground transition-colors text-left w-full cursor-pointer"
      >
        <Badge
          variant="secondary"
          className="shrink-0 text-[10px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-none"
        >
          Bash
        </Badge>

        <code className="bg-muted/40 px-1.5 py-0.5 rounded border border-transparent group-hover:border-border w-0 flex-1 block truncate">
          {command || block.input?.description}
        </code>

        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-auto">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="rounded-md overflow-hidden flex flex-col">
          <CommandValue value={command} />

          {errorText && (
            <div className="relative flex items-start justify-between gap-4 bg-zinc-900 dark:bg-zinc-950 border-x border-b border-zinc-700/60 rounded-b-md group/output">
              <div className="text-[11px] font-mono text-red-400 flex-1 break-all whitespace-pre-wrap py-2 px-3 max-h-48 overflow-y-auto">
                {errorText}
              </div>
              <div className="shrink-0 opacity-0 group-hover/output:opacity-100 transition-opacity duration-150">
                <CopyButton text={errorText} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
