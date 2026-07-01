import { useState } from "react";
import { ThreadItem } from "@/bindings/v2";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, ChevronDown, ChevronRight } from "lucide-react";
import { fmtElapsed } from "@/components/agent/utils";

type Props = {
  item: ThreadItem
}

export function McpToolCallItem({ item }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (item.type !== 'mcpToolCall') return null;
  const status = item.status

  const hasDetails = item.result || item.error;

  return (
    <div className="flex flex-col gap-1.5 w-full text-sm text-neutral-600 dark:text-neutral-300">
      <div
        className={`flex items-center gap-2 ${hasDetails ? 'cursor-pointer select-none' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >

        <Badge>{item.server}</Badge>
        <span className="font-mono font-medium">{item.tool}</span>

        <div className="flex items-center shrink-0 ml-1">
          {status === 'inProgress' && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          )}
          {status === 'failed' && (
            <X className="h-3.5 w-3.5 text-red-500 stroke-[2.5]" />
          )}
          {status === 'completed' && (
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
          )}
        </div>

        {hasDetails && (
          <div className="text-neutral-400">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        )}

        {item.mcpAppResourceUri && (
          <div className="ml-auto text-xs text-neutral-400 max-w-[150px] truncate">
            {item.mcpAppResourceUri}
          </div>
        )}

        {status !== 'inProgress' && typeof item.durationMs === 'number' && (
          <span className="ml-auto text-xs text-neutral-400 font-mono shrink-0">
            {fmtElapsed(item.durationMs)}
          </span>
        )}
      </div>

      {isExpanded && hasDetails && (
        <div className="pl-5 pr-2 pb-2">
          {status === 'failed' && item.error && (
            <div className="text-xs font-mono p-2 rounded bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400">
              {item.error.message}
            </div>
          )}

          {status === 'completed' && item.result && (
            <div className="text-xs font-mono p-2 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 text-neutral-500 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
              {item.result.structuredContent
                ? JSON.stringify(item.result.structuredContent, null, 2)
                : JSON.stringify(item.result.content, null, 2)
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}