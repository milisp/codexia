import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileUpdateChange } from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { DiffViewer } from '@/features/DiffViewer';
import { useWorkspaceStore } from '@/stores';
import type { AggregatedFileChange, DiffViewerInput } from './fileChangeLogic';
import { toRelativePath } from './fileChangeUtils';

type SummaryFileChangesProps = {
  changes: AggregatedFileChange[];
  getDiffViewerProps: (change: {
    path: string;
    kind: FileUpdateChange['kind'];
    diff: string;
  }) => DiffViewerInput;
};

/**
 * Full per-file diff view, used by the right panel's review tab.
 */
export const SummaryFileChanges = ({ changes, getDiffViewerProps }: SummaryFileChangesProps) => {
  const { t } = useTranslation('thread');
  const { cwd } = useWorkspaceStore();
  const [allCollapsed, setAllCollapsed] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  if (changes.length === 0) return null;

  const totals = changes.reduce(
    (acc, change) => {
      acc.added += change.addedCount;
      acc.removed += change.removedCount;
      return acc;
    },
    { added: 0, removed: 0 }
  );

  const toggleAll = () => {
    setAllCollapsed((prev) => !prev);
    setResetKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-2 border rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span>{t('fileChanges.changed', { count: changes.length })}</span>
          <span className="flex items-center gap-2 text-xs">
            <span className="text-green-600 dark:text-green-400">+{totals.added}</span>
            <span className="text-red-600 dark:text-red-400">-{totals.removed}</span>
          </span>
        </div>
        <Button variant="outline" size="sm" className="h-6 px-2 gap-1" onClick={toggleAll}>
          {allCollapsed ? (
            <ChevronsUpDown className="h-3 w-3" />
          ) : (
            <ChevronsDownUp className="h-3 w-3" />
          )}
          {allCollapsed ? t('fileChanges.expandAll') : t('fileChanges.collapseAll')}
        </Button>
      </div>

      <div className="space-y-2">
        {changes.map((change) => (
          <div key={change.path} className="border rounded-md overflow-hidden">
            <DiffViewer
              {...getDiffViewerProps(change)}
              displayPath={toRelativePath(change.path, cwd)}
              isCollapsed={allCollapsed}
              resetKey={resetKey}
              className="max-h-96"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
