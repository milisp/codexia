import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitFileTree } from './GitFileTree';
import type { DiffSection, TreeNode } from './types';

interface GitFileTreePanelProps {
  cwd: string | null;
  selectedDiffSection: DiffSection;
  bulkStagePaths: string[];
  bulkStageLoading: boolean;
  filterText: string;
  gitError: string | null;
  filteredEntriesCount: number;
  fileTree: TreeNode[];
  selectedDiffPath: string | null;
  collapsedFolders: Set<string>;
  onOpenBulkStageDialog: () => void;
  onFilterTextChange: (value: string) => void;
  onToggleFolder: (path: string) => void;
  onSelectPath: (section: DiffSection, path: string) => void;
  onStage: (paths: string[]) => Promise<void>;
  onUnstage: (paths: string[]) => Promise<void>;
}

export function GitFileTreePanel({
  cwd,
  selectedDiffSection,
  bulkStagePaths,
  bulkStageLoading,
  filterText,
  gitError,
  filteredEntriesCount,
  fileTree,
  selectedDiffPath,
  collapsedFolders,
  onOpenBulkStageDialog,
  onFilterTextChange,
  onToggleFolder,
  onSelectPath,
  onStage,
  onUnstage,
}: GitFileTreePanelProps) {
  return (
    <div className="w-64 min-w-[220px] min-h-0 border-l border-white/10 flex flex-col">
      <div className="px-3 border-b border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">File tree</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onOpenBulkStageDialog}
            disabled={bulkStagePaths.length === 0 || bulkStageLoading}
            title={
              selectedDiffSection === 'staged'
                ? 'Switch to Unstaged to use one-key stage'
                : 'Stage all files in current list'
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Stage all
          </Button>
        </div>
        <Input
          value={filterText}
          onChange={(event) => onFilterTextChange(event.target.value)}
          placeholder="Filter filename or folder..."
          className="h-8 text-xs"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-2 space-y-1">
          {gitError && (
            <div className="text-xs text-destructive rounded border border-destructive/30 p-2">
              {gitError}
            </div>
          )}
          {filteredEntriesCount === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No files matched current filter.
            </div>
          )}
          {cwd ? (
            <GitFileTree
              fileTree={fileTree}
              selectedDiffPath={selectedDiffPath}
              selectedDiffSection={selectedDiffSection}
              collapsedFolders={collapsedFolders}
              onToggleFolder={onToggleFolder}
              onSelectPath={onSelectPath}
              onStage={onStage}
              onUnstage={onUnstage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
