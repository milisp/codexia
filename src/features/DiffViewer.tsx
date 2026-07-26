import * as Diff from 'diff';
import { Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDiffCounts, normalizeUnifiedDiff } from '@/utils/diff';

interface DiffViewerProps {
  original?: string;
  current?: string;
  unifiedDiff?: string;
  displayPath?: string;
  isCollapsed?: boolean;
  className?: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'normal';
  content: string;
  lineNumber: {
    old?: number;
    new?: number;
  };
}

const shouldSkipUnifiedLine = (line: string) =>
  /^\s*(new file|deleted file)\b/i.test(line) ||
  /^\s*mode \d+/i.test(line) ||
  /^\s*(new mode|old mode)\b/i.test(line) ||
  /^\s*similarity index\b/i.test(line) ||
  /^\s*rename (from|to)\b/i.test(line) ||
  /\*\*\* (Begin Patch|End Patch|Update File:)/i.test(line);

const getFilename = (path: string) => {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || path;
};

const VIEW_MODES: Array<'old' | 'new' | 'diff'> = ['old', 'new', 'diff'];

export function DiffViewer({
  original = '',
  current = '',
  unifiedDiff,
  displayPath,
  isCollapsed = true,
  className,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'old' | 'new' | 'diff'>('diff');
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Use isCollapsed prop directly instead of mirroring into state
  const collapsed = isCollapsed;

  const normalizedUnified = useMemo(() => normalizeUnifiedDiff(unifiedDiff), [unifiedDiff]);

  // If unifiedDiff is provided, approximate split to left/right
  const { left, right } = useMemo(() => {
    if (!normalizedUnified) return { left: original, right: current };
    const lines = normalizedUnified.split('\n');
    const orig: string[] = [];
    const curr: string[] = [];
    for (const line of lines) {
      const skipLine = shouldSkipUnifiedLine(line);
      if (
        skipLine ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('@@') ||
        line.startsWith('diff --git') ||
        line.startsWith('index ')
      )
        continue;
      if (line.startsWith('-')) {
        orig.push(line.slice(1));
      } else if (line.startsWith('+')) {
        curr.push(line.slice(1));
      } else {
        orig.push(line);
        curr.push(line);
      }
    }
    return { left: orig.join('\n'), right: curr.join('\n') };
  }, [normalizedUnified, original, current]);

  const diffLines = useMemo((): DiffLine[] => {
    if (viewMode === 'old') {
      return left.split('\n').map(
        (content, i): DiffLine => ({
          type: 'normal',
          content,
          lineNumber: { old: i + 1 },
        })
      );
    }
    if (viewMode === 'new') {
      return right.split('\n').map(
        (content, i): DiffLine => ({
          type: 'normal',
          content,
          lineNumber: { new: i + 1 },
        })
      );
    }
    const changes = Diff.diffLines(left, right) as Diff.Change[];
    let oldLineNum = 0;
    let newLineNum = 0;
    const result: DiffLine[] = [];
    for (const change of changes) {
      if (change.added) {
        const lines = change.value.split('\n').slice(0, -1);
        for (const content of lines) {
          result.push({
            type: 'add',
            content,
            lineNumber: { new: ++newLineNum },
          });
        }
      } else if (change.removed) {
        const lines = change.value.split('\n').slice(0, -1);
        for (const content of lines) {
          result.push({
            type: 'remove',
            content,
            lineNumber: { old: ++oldLineNum },
          });
        }
      } else {
        const lines = change.value.split('\n').slice(0, -1);
        for (const content of lines) {
          result.push({
            type: 'normal',
            content,
            lineNumber: { old: ++oldLineNum, new: ++newLineNum },
          });
        }
      }
    }
    return result;
  }, [left, right, viewMode]);

  const { addedCount, removedCount } = useMemo(() => getDiffCounts({ diffLines }), [diffLines]);

  const handleCopy = () => {
    const text =
      viewMode === 'diff'
        ? diffLines
            .map((l) => {
              const prefix = l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' ';
              return `${prefix} ${l.content}`;
            })
            .join('\n')
        : viewMode === 'old'
          ? left
          : right;
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const fileName = displayPath ? getFilename(displayPath) : 'diff';

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h4 className="font-mono text-sm truncate max-w-[200px]">{fileName}</h4>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 gap-1"
              onClick={handleCopy}
              disabled={copied}
              type="button"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <div className="flex rounded-md border bg-muted p-1">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'px-2 py-0.5 text-xs rounded transition-colors',
                    viewMode === mode
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {mode === 'old' ? 'Old' : mode === 'new' ? 'New' : 'Diff'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {viewMode === 'diff' && addedCount > 0 && (
            <span className="text-green-500">+{addedCount}</span>
          )}
          {viewMode === 'diff' && removedCount > 0 && (
            <span className="text-red-500">-{removedCount}</span>
          )}
        </div>
      </div>
      <div
        className={cn('font-mono text-sm overflow-x-auto max-h-[500px]', collapsed && 'max-h-32')}
      >
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'flex border-b last:border-0',
              line.type === 'add' && 'bg-green-500/10',
              line.type === 'remove' && 'bg-red-500/10'
            )}
          >
            <div className="flex-shrink-0 w-16 px-2 text-right text-muted-foreground/60 select-none">
              {line.lineNumber.old ?? ''}
            </div>
            <div className="flex-shrink-0 w-16 px-2 text-right text-muted-foreground/60 select-none">
              {line.lineNumber.new ?? ''}
            </div>
            <div className="flex-1 min-w-0 px-3 py-0.5 select-none">
              <span
                className={cn(
                  'whitespace-pre',
                  line.type === 'add' && 'text-green-600',
                  line.type === 'remove' && 'text-red-600'
                )}
              >
                {line.content || ' '}
              </span>
            </div>
          </div>
        ))}
      </div>
      {collapsed && diffLines.length > 15 && (
        <button
          type="button"
          onClick={() => {}}
          className="w-full px-3 py-2 text-center text-sm text-primary hover:bg-primary/10"
        >
          Show {diffLines.length} lines
        </button>
      )}
    </div>
  );
}
