import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { FileUpdateChange } from '@/bindings/v2';
import { DiffViewer } from '@/components/features/DiffViewer';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { getFilename } from '@/utils/getFilename';
import type { DiffViewerInput } from './fileChangeLogic';

type IndividualFileChangesProps = {
  changes: FileUpdateChange[];
  fileChangeMap: Record<FileUpdateChange['kind']['type'], string>;
  getChangeCounts: (
    kind: FileUpdateChange['kind'],
    diff: string
  ) => {
    addedCount: number;
    removedCount: number;
  };
  getDiffViewerProps: (change: {
    path: string;
    kind: FileUpdateChange['kind'];
    diff: string;
  }) => DiffViewerInput;
};

export const IndividualFileChanges = ({
  changes,
  fileChangeMap,
  getChangeCounts,
  getDiffViewerProps,
}: IndividualFileChangesProps) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div>
      {changes.map((change, index) => {
        const key = `${change.path}-${index}`;
        const isExpanded = expandedKeys.has(key);
        const { addedCount, removedCount } = getChangeCounts(change.kind, change.diff);

        return (
          <div key={key}>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="h-auto px-1 text-sm"
                onClick={() => toggleExpanded(key)}
              >
                {fileChangeMap[change.kind.type]}
              </Button>
              <Markdown value={`[${getFilename(change.path)}](${change.path})`} />
              <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="text-green-600 dark:text-green-400">+{addedCount}</span>
                <span className="text-red-600 dark:text-red-400">-{removedCount}</span>
              </span>
              <Button size="icon" variant="ghost" onClick={() => toggleExpanded(key)}>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </Button>
            </div>
            {isExpanded && (
              <DiffViewer
                {...getDiffViewerProps(change)}
                isCollapsed={false}
                className="mt-2 max-h-64"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
