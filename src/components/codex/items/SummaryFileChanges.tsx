import type { FileUpdateChange } from '@/bindings/v2';
import { DiffViewer } from '@/components/features/DiffViewer';
import type { AggregatedFileChange, DiffViewerInput } from './fileChangeLogic';

type SummaryFileChangesProps = {
  changes: AggregatedFileChange[];
  getDiffViewerProps: (change: {
    path: string;
    kind: FileUpdateChange['kind'];
    diff: string;
  }) => DiffViewerInput;
};

export const SummaryFileChanges = ({ changes, getDiffViewerProps }: SummaryFileChangesProps) => {
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
    <div className="space-y-3 border rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">
          {changes.length} file{changes.length !== 1 ? 's' : ''} changed
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600 dark:text-green-400">+{totals.added}</span>
          <span className="text-red-600 dark:text-red-400">-{totals.removed}</span>
        </div>
      </div>

      <div>
        {changes.map((change) => (
          <div key={change.path} className="border rounded-md overflow-hidden">
            <DiffViewer {...getDiffViewerProps(change)} isCollapsed className="max-h-96" />
          </div>
        ))}
      </div>
    </div>
  );
};
