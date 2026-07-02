import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const INLINE_STRING_LIMIT = 80;
const PREVIEW_LINES = 4;
/** Keys whose values are rendered as shell commands */
const COMMAND_KEYS = new Set(['command', 'cmd']);

function isPlainScalar(v: unknown): v is string | number | boolean | null {
  return v === null || typeof v !== 'object';
}

/** Terminal-style block for shell command values */
export function CommandValue({ value }: { value: string }) {
  const lines = value.split('\n');
  const isMultiline = lines.length > 1;
  const [expanded, setExpanded] = useState(false);
  const preview = lines.slice(0, PREVIEW_LINES).join('\n');
  const hasMore = lines.length > PREVIEW_LINES;

  return (
    <div className="w-full rounded-md overflow-hidden border border-zinc-700/60 bg-zinc-900 dark:bg-zinc-950 text-[11px] font-mono">
      {/* title bar */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/80 border-b border-zinc-700/40">
        <Terminal className="w-3 h-3 text-zinc-400" />
        <span className="text-zinc-500 text-[10px]">bash</span>
      </div>
      {/* command body */}
      <pre className="px-3 py-2 text-emerald-300 whitespace-pre-wrap break-all overflow-auto max-h-56 leading-relaxed">
        <span className="text-zinc-500 select-none mr-1.5">$</span>
        {expanded || !isMultiline ? value : preview}
        {!expanded && hasMore && <span className="text-zinc-600"> …</span>}
      </pre>
      {hasMore && (
        <div className="px-2 pb-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? (
              <>
                <ChevronDown className="w-3 h-3 mr-0.5" />
                Collapse
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3 mr-0.5" />
                {lines.length - PREVIEW_LINES} more lines
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Inline or expandable block for plain scalar values */
function ScalarValue({ value }: { value: string | number | boolean | null }) {
  const str = value === null ? 'null' : String(value);
  const lines = str.split('\n');
  const [expanded, setExpanded] = useState(false);

  if (lines.length === 1 && str.length <= INLINE_STRING_LIMIT) {
    return <span className="font-mono text-[11px] text-foreground/80 break-all">{str}</span>;
  }

  const preview = lines.slice(0, PREVIEW_LINES).join('\n');
  const hasMore = lines.length > PREVIEW_LINES;

  return (
    <div className="w-full">
      <pre className="font-mono text-[10px] text-foreground/75 bg-muted/40 rounded p-2 border border-border/40 overflow-auto max-h-56 whitespace-pre-wrap break-all">
        {expanded ? str : preview}
        {!expanded && hasMore && '…'}
      </pre>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-[10px] text-muted-foreground mt-0.5"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3 h-3 mr-0.5" />
              Collapse
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3 mr-0.5" />
              {lines.length - PREVIEW_LINES} more lines
            </>
          )}
        </Button>
      )}
    </div>
  );
}

/** Collapsed/expandable block for complex object/array values */
function ComplexValue({ value }: { value: object }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(value, null, 2);
  const label = Array.isArray(value)
    ? `[${(value as unknown[]).length} items]`
    : `{${Object.keys(value).length} keys}`;

  return (
    <div className="w-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1 text-[10px] text-muted-foreground mb-0.5"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? (
          <>
            <ChevronDown className="w-3 h-3 mr-0.5" />
            Collapse
          </>
        ) : (
          <>
            <ChevronRight className="w-3 h-3 mr-0.5" />
            {label}
          </>
        )}
      </Button>
      {expanded && (
        <pre className="font-mono text-[10px] text-foreground/75 bg-muted/40 rounded p-2 border border-border/40 overflow-auto max-h-56 whitespace-pre-wrap break-all">
          {json}
        </pre>
      )}
    </div>
  );
}

interface Props {
  input: Record<string, unknown>;
  /** Keys rendered with amber accent (e.g. file paths) */
  highlightKeys?: string[];
  className?: string;
}

/**
 * Renders tool input params as a clean key-value list.
 * - command/cmd keys → terminal-style dark block with $ prefix
 * - long strings     → collapsible <pre>
 * - objects/arrays   → collapsed by default, expand on click
 */
export function ToolInputDisplay({ input, highlightKeys = [], className }: Props) {
  const entries = Object.entries(input);

  if (entries.length === 0) {
    return <span className="text-[10px] text-muted-foreground italic">no params</span>;
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      {entries.map(([key, value]) => {
        const isCommand = COMMAND_KEYS.has(key) && typeof value === 'string';
        return (
          <div
            key={key}
            className={`flex gap-2 items-start text-xs min-w-0 ${isCommand ? 'flex-col' : ''}`}
          >
            <span
              className={`shrink-0 font-medium text-[10px] uppercase tracking-wide pt-0.5 ${
                highlightKeys.includes(key)
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground'
              }`}
            >
              {key}
            </span>
            <div className="min-w-0 flex-1 w-full">
              {isCommand ? (
                <CommandValue value={value as string} />
              ) : isPlainScalar(value) ? (
                <ScalarValue value={value} />
              ) : (
                <ComplexValue value={value as object} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
