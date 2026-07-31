import { Diff, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { DiffViewer } from '@/features/DiffViewer';
import { gitReverseFiles } from '@/services/tauri';
import { useEditorStore, useWorkspaceStore } from '@/stores';
import { getDiffViewerProps } from './fileChangeLogic';
import type { AggregatedFileChange } from './fileChangeLogic';
import { toRelativePath, useOpenReviewTab } from './SummaryFileChanges';

type ThreadFileChangesSummaryProps = {
  changes: AggregatedFileChange[];
};

type PendingUndo = { kind: 'all' } | { kind: 'file'; path: string };

/**
 * Compact turn-diff summary shown inline in CodexThread. Deliberately does
 * not render per-file diffs — that's the right panel's review tab's job.
 */
export const ThreadFileChangesSummary = ({ changes }: ThreadFileChangesSummaryProps) => {
  const { cwd } = useWorkspaceStore();
  const { hasConfirmedGitRevert, setHasConfirmedGitRevert } = useEditorStore();
  const openReviewTab = useOpenReviewTab();
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [undoing, setUndoing] = useState(false);

  if (changes.length === 0) return null;

  const totals = changes.reduce(
    (acc, change) => {
      acc.added += change.addedCount;
      acc.removed += change.removedCount;
      return acc;
    },
    { added: 0, removed: 0 }
  );

  const doUndo = async (target: PendingUndo) => {
    if (!cwd) return;
    const paths = target.kind === 'all' ? changes.map((change) => change.path) : [target.path];
    setUndoing(true);
    try {
      await gitReverseFiles(cwd, paths, false);
    } finally {
      setUndoing(false);
      setPendingUndo(null);
    }
  };

  const requestUndo = (target: PendingUndo) => {
    if (!hasConfirmedGitRevert) {
      setPendingUndo(target);
      return;
    }
    void doUndo(target);
  };

  return (
    <div className="space-y-1 border rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">
          {changes.length} file{changes.length !== 1 ? 's' : ''} changed
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 gap-1.5"
            onClick={() => requestUndo({ kind: 'all' })}
            disabled={undoing}
            title="Undo all changes in this turn"
          >
            <Undo2 className="h-3 w-3" />
            Undo All
          </Button>
          <Button variant="outline" size="sm" className="h-6 px-2 gap-1.5" onClick={openReviewTab}>
            <Diff className="h-3 w-3" />
            Review
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-green-600 dark:text-green-400">+{totals.added}</span>
              <span className="text-red-600 dark:text-red-400">-{totals.removed}</span>
            </span>
          </Button>
        </div>
      </div>

      {pendingUndo && (
        <div className="flex items-center gap-2 rounded-sm bg-destructive/10 px-2 py-1.5 text-xs">
          <span className="flex-1 text-destructive">
            {pendingUndo.kind === 'all'
              ? `Undo all ${changes.length} file changes? This discards them on disk.`
              : `Undo changes to ${toRelativePath(pendingUndo.path, cwd)}? This discards them on disk.`}
          </span>
          <Button
            size="sm"
            variant="destructive"
            className="h-6 px-2 text-xs"
            onClick={() => {
              setHasConfirmedGitRevert(true);
              void doUndo(pendingUndo);
            }}
          >
            Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setPendingUndo(null)}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="divide-y">
        {changes.map((change) => (
          <div
            key={change.path}
            className="flex w-full items-center justify-between gap-3 py-1.5 text-sm hover:bg-muted/50 rounded-sm px-1 -mx-1"
          >
            <HoverCard openDelay={200}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onClick={openReviewTab}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="font-mono truncate block">
                    {toRelativePath(change.path, cwd)}
                  </span>
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-[36rem] max-w-[80vw] p-0 overflow-hidden">
                <DiffViewer
                  {...getDiffViewerProps(change)}
                  displayPath={toRelativePath(change.path, cwd)}
                  isCollapsed={false}
                  className="max-h-96"
                />
              </HoverCardContent>
            </HoverCard>
            <span className="flex items-center gap-2 text-xs shrink-0">
              <span className="text-green-600 dark:text-green-400">+{change.addedCount}</span>
              <span className="text-red-600 dark:text-red-400">-{change.removedCount}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => requestUndo({ kind: 'file', path: change.path })}
              disabled={undoing}
              title="Undo changes to this file"
            >
              <Undo2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
