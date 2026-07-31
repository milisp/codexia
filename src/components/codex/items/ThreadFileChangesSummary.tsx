import { Diff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/stores';
import type { AggregatedFileChange } from './fileChangeLogic';
import { toRelativePath, useOpenReviewTab } from './SummaryFileChanges';

type ThreadFileChangesSummaryProps = {
  changes: AggregatedFileChange[];
};

/**
 * Compact turn-diff summary shown inline in CodexThread. Deliberately does
 * not render per-file diffs — that's the right panel's review tab's job.
 */
export const ThreadFileChangesSummary = ({ changes }: ThreadFileChangesSummaryProps) => {
  const { cwd } = useWorkspaceStore();
  const openReviewTab = useOpenReviewTab();

  if (changes.length === 0) return null;

  const totals = changes.reduce(
    (acc, change) => {
      acc.added += change.addedCount;
      acc.removed += change.removedCount;
      return acc;
    },
    { added: 0, removed: 0 }
  );

  return (
    <div className="space-y-1 border rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">
          {changes.length} file{changes.length !== 1 ? 's' : ''} changed
        </div>
        <Button variant="outline" size="sm" className="h-6 px-2 gap-1.5" onClick={openReviewTab}>
          <Diff className="h-3 w-3" />
          Review
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-green-600 dark:text-green-400">+{totals.added}</span>
            <span className="text-red-600 dark:text-red-400">-{totals.removed}</span>
          </span>
        </Button>
      </div>

      <div className="divide-y">
        {changes.map((change) => (
          <button
            key={change.path}
            type="button"
            onClick={openReviewTab}
            className="flex w-full items-center justify-between gap-3 py-1.5 text-left text-sm hover:bg-muted/50 rounded-sm px-1 -mx-1"
          >
            <span className="font-mono truncate">{toRelativePath(change.path, cwd)}</span>
            <span className="flex items-center gap-2 text-xs shrink-0">
              <span className="text-green-600 dark:text-green-400">+{change.addedCount}</span>
              <span className="text-red-600 dark:text-red-400">-{change.removedCount}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
