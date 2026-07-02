import type { GitStatusEntry } from '@/services/tauri';
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
  onSelect: (path: string) => void;
  onRefreshStatus: () => void;
}

export function GitDiffFileList({
  cwd,
  entries,
  section,
  diffSource,
  wordWrapEnabled,
  selectedDiffPath,
  refreshKey,
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

  // Auto-expand all files if there are 10 or fewer; otherwise only the first 5
  const autoExpandThreshold = entries.length <= 10 ? entries.length : 5;

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
          defaultExpanded={index < autoExpandThreshold}
          isSelected={selectedDiffPath === entry.path}
          refreshKey={refreshKey}
          onSelect={() => onSelect(entry.path)}
          onRefreshStatus={onRefreshStatus}
        />
      ))}
    </div>
  );
}
