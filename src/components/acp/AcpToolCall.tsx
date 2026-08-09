import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DiffMessage } from '@/components/cc/session/messages/DiffMessage';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AcpEntry, AcpToolContent } from '@/stores/useAcpStore';

type ToolEntry = Extract<AcpEntry, { role: 'tool' }>;

const STATUS_TONE: Record<string, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-blue-600 dark:text-blue-400',
  completed: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-destructive',
};

/** Text of a `content` block, or null when it carries no inline text. */
function blockText(item: AcpToolContent): string | null {
  if (item.type !== 'content') return null;
  if (item.content.type === 'text') return item.content.text ?? '';
  return item.content.uri ?? null;
}

function ToolContent({ item }: { item: AcpToolContent }) {
  if (item.type === 'diff') {
    return (
      <div className="space-y-1">
        <div className="font-mono text-[11px] text-muted-foreground">{item.path}</div>
        <DiffMessage oldString={item.oldText ?? ''} newString={item.newText} />
      </div>
    );
  }

  if (item.type === 'terminal') {
    return (
      <div className="font-mono text-[11px] text-muted-foreground">terminal {item.terminalId}</div>
    );
  }

  const text = blockText(item);
  if (text === null) return null;
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 font-mono text-[11px]">
      {text}
    </pre>
  );
}

/**
 * One ACP tool call: a title + status row that expands into whatever the agent
 * attached — diffs, command output, or the raw input when there is no content.
 */
export function AcpToolCall({ entry }: { entry: ToolEntry }) {
  const [open, setOpen] = useState(false);
  const content = entry.content ?? [];
  const rawInput =
    content.length === 0 && entry.rawInput ? JSON.stringify(entry.rawInput, null, 2) : null;
  const expandable = content.length > 0 || rawInput !== null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger
        disabled={!expandable}
        className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs disabled:cursor-default"
      >
        {expandable ? (
          open ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate font-mono">{entry.title}</span>
        <Badge
          variant="secondary"
          className={`ml-auto shrink-0 ${STATUS_TONE[entry.status] ?? ''}`}
        >
          {entry.status}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2 border-t px-2 py-2">
        {content.map((item, i) => (
          <ToolContent key={i} item={item} />
        ))}
        {rawInput && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 font-mono text-[11px]">
            {rawInput}
          </pre>
        )}
        {entry.locations && entry.locations.length > 0 && (
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {entry.locations.map((loc, i) => (
              <span key={i} className="font-mono">
                {loc.line ? `${loc.path}:${loc.line}` : loc.path}
              </span>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
