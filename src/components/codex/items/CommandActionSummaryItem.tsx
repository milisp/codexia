import { ChevronDown, ChevronRight, SquareTerminal } from 'lucide-react';
import { useState } from 'react';
import type { CommandAction } from '@/bindings/v2';
import { CommandActionItem } from './CommandActionItem';

type Props = {
  actions: CommandAction[];
  commandItemId?: string | null;
  aggregatedOutput?: string | null;
  /** True when this group has been followed by an agentMessage — show fully collapsed. */
  completed: boolean;
};

// Count actions by type and build a summary label.
function buildSummaryParts(actions: CommandAction[]): string[] {
  const counts: Record<string, number> = { read: 0, unknown: 0, listFiles: 0, search: 0 };
  for (const a of actions) counts[a.type] = (counts[a.type] ?? 0) + 1;

  const parts: string[] = [];
  const p = (n: number, singular: string, plural: string) =>
    n > 0 ? parts.push(`${n} ${n === 1 ? singular : plural}`) : undefined;

  p(counts.read, 'Read file', 'Read files');
  p(counts.unknown, 'Ran command', 'Ran commands');
  p(counts.listFiles, 'Listed folder', 'Listed folders');
  p(counts.search, 'Searched', 'Searched');

  return parts;
}

export const CommandActionSummaryItem = ({
  actions,
  commandItemId,
  aggregatedOutput,
  completed,
}: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (actions.length === 0) return null;

  // All actions collapsed under summary toggle.
  if (completed) {
    const parts = buildSummaryParts(actions);
    if (parts.length === 0) return null;
    return (
      <div className="text-xs text-muted-foreground">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer py-0.5"
        >
          <SquareTerminal className="h-3 w-3" />
          {parts.join(', ')}
          {expanded ? (
            <ChevronDown className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" />
          )}
        </button>
        {expanded && (
          <div className="mt-1 ml-2 space-y-1 border-l pl-1 border-border/50">
            {actions.map((action, i) => (
              <CommandActionItem
                key={i}
                action={action}
                commandItemId={commandItemId}
                aggregatedOutput={aggregatedOutput}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Streaming: show last action inline, rest collapsed.
  const hiddenActions = actions.slice(0, -1);
  const lastAction = actions[actions.length - 1];
  const hiddenParts = buildSummaryParts(hiddenActions);

  return (
    <div className="text-xs text-muted-foreground space-y-1">
      {hiddenActions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer py-0.5"
          >
            <SquareTerminal className="h-3 w-3" />
            {hiddenParts.join(', ')}
            {expanded ? (
              <ChevronDown className="w-3 h-3 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0" />
            )}
          </button>
          {expanded && (
            <div className="ml-2 space-y-1 border-l pl-1 border-border/50">
              {hiddenActions.map((action, i) => (
                <CommandActionItem
                  key={i}
                  action={action}
                  commandItemId={commandItemId}
                  aggregatedOutput={aggregatedOutput}
                />
              ))}
            </div>
          )}
        </>
      )}
      {/* Last action always visible during streaming */}
      <div className="flex items-center gap-1 py-0.5">
        <SquareTerminal className="h-3 w-3 shrink-0" />
        <CommandActionItem
          action={lastAction}
          commandItemId={commandItemId}
          aggregatedOutput={aggregatedOutput}
        />
      </div>
    </div>
  );
};
