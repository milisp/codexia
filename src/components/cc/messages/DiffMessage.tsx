import * as Diff from 'diff';
import { FilePlus, FileText, GitCompare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface DiffMessageProps {
  oldString: string;
  newString: string;
}

type ViewMode = 'diff' | 'old' | 'new';

interface DiffLine {
  type: 'add' | 'remove' | 'normal';
  content: string;
}

export function DiffMessage({ oldString, newString }: DiffMessageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('diff');

  const diffLines = (() => {
    const changes = Diff.diffLines(oldString, newString);
    const result: DiffLine[] = [];

    changes.forEach((change: Diff.Change) => {
      const lines = change.value.split('\n');
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      lines.forEach((line) => {
        if (change.added) {
          result.push({ type: 'add', content: line });
        } else if (change.removed) {
          result.push({ type: 'remove', content: line });
        } else {
          result.push({ type: 'normal', content: line });
        }
      });
    });

    return result;
  })();

  return (
    <div className="flex flex-col gap-2">
      {/* View mode buttons */}
      <div className="flex gap-1">
        <Button
          variant={viewMode === 'diff' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('diff')}
          className="h-7 px-2"
        >
          <GitCompare className="h-3 w-3 mr-1" />
          Diff
        </Button>
        <Button
          variant={viewMode === 'old' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('old')}
          className="h-7 px-2"
        >
          <FileText className="h-3 w-3 mr-1" />
          Old
        </Button>
        <Button
          variant={viewMode === 'new' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('new')}
          className="h-7 px-2"
        >
          <FilePlus className="h-3 w-3 mr-1" />
          New
        </Button>
      </div>

      {/* Content display */}
      <div className="bg-background/50 rounded-lg border border-border overflow-hidden">
        {viewMode === 'diff' && (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <tbody>
                {diffLines.map((line, index) => (
                  <tr
                    key={index}
                    className={
                      line.type === 'add'
                        ? 'bg-emerald-500/10'
                        : line.type === 'remove'
                          ? 'bg-red-500/10'
                          : ''
                    }
                  >
                    <td
                      className={`w-8 text-center select-none font-medium border-r border-border/50 ${
                        line.type === 'add'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : line.type === 'remove'
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : 'bg-muted/50 text-muted-foreground/50'
                      }`}
                    >
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ''}
                    </td>
                    <td className="px-2 py-0.5 break-all whitespace-pre-wrap">{line.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'old' && (
          <pre className="p-3 text-xs overflow-x-auto break-all whitespace-pre-wrap font-mono bg-background/30">
            <code>{oldString}</code>
          </pre>
        )}

        {viewMode === 'new' && (
          <pre className="p-3 text-xs overflow-x-auto break-all whitespace-pre-wrap font-mono bg-background/30">
            <code>{newString}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
