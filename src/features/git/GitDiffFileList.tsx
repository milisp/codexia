import type { GitStatusEntry } from '@/services/apiAdapt';
import { GitDiffFileItem } from './GitDiffFileItem';
import type { DiffSection, DiffSource } from './types';

interface GitDiffFileListProps {
  cwd: string | null;
  entries: GitStatusEntry[];
  section: DiffSection;
  diffSource: DiffSource;
  wordWrapEnabled: boolean;
  selectedDiffPath: string | null;
  refreshKey: number;
  expandedDiffs: Record<string, boolean>;
  onExpandedChange: (path: string, expanded: boolean) => void;
  onSelect: (path: string) => void;
  onRefreshStatus: () => void;
}

/** Auto-expand all files when the list is short, otherwise only the first few. */
export function isDiffAutoExpanded(index: number, total: number): boolean {
  return index < (total <= 10 ? total : 5);
}

export function GitDiffFileList({
  cwd,
  entries,
  section,
  diffSource,
  wordWrapEnabled,
  selectedDiffPath,
  refreshKey,
  expandedDiffs,
  onExpandedChange,
  onSelect,
  onRefreshStatus,
}: GitDiffFileListProps) {
  if (!cwd) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No workspace open
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No changed files
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
      {entries.map((entry, index) => (
        <GitDiffFileItem
          key={entry.path}
          cwd={cwd}
          entry={entry}
          section={section}
          diffSource={diffSource}
          wordWrapEnabled={wordWrapEnabled}
          expanded={expandedDiffs[entry.path] ?? isDiffAutoExpanded(index, entries.length)}
          isSelected={selectedDiffPath === entry.path}
          refreshKey={refreshKey}
          onExpandedChange={(value) => onExpandedChange(entry.path, value)}
          onSelect={() => onSelect(entry.path)}
          onRefreshStatus={onRefreshStatus}
        />
      ))}
    </div>
  );
}
