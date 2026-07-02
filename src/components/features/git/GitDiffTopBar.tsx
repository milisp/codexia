import { Columns2, Folder, FolderOpen, Menu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLayoutStore } from '@/stores';
import { GitActions } from './GitActions';
import { GitStatsIndicator } from './GitStatsIndicator';
import type { DiffSection, DiffSource } from './types';

interface GitDiffTopBarProps {
  cwd: string | null;
  gitLoading: boolean;
  diffSource: DiffSource;
  onDiffSourceChange: (value: DiffSource) => void;
  selectedDiffSection: DiffSection;
  onDiffSectionChange: (value: DiffSection) => void;
  unstagedCount: number;
  stagedCount: number;
  showFileTree: boolean;
  onToggleFileTree: () => void;
  onRefresh: () => void;
}

export function GitDiffTopBar({
  cwd,
  gitLoading,
  diffSource,
  onDiffSourceChange,
  selectedDiffSection,
  onDiffSectionChange,
  unstagedCount,
  stagedCount,
  showFileTree,
  onToggleFileTree,
  onRefresh,
}: GitDiffTopBarProps) {
  const { diffWordWrap, setDiffWordWrap, diffSplitMode, setDiffSplitMode } = useLayoutStore();

  return (
    <div className="border-b border-white/10 flex items-center gap-2">
      <div className="shrink-0">
        <Select
          value={diffSource}
          onValueChange={(value) => {
            const src = value as DiffSource;
            onDiffSourceChange(src);
            if (src === 'unstaged' || src === 'staged') {
              onDiffSectionChange(src);
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unstaged">unstaged ({unstagedCount})</SelectItem>
            <SelectItem value="staged">staged ({stagedCount})</SelectItem>
            <SelectItem value="latest-turn">latest turn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {diffSource !== 'latest-turn' && <GitStatsIndicator diffSection={selectedDiffSection} />}

      <div className="flex-1" />

      <div className="flex items-center">
        <GitActions />
        <Button
          variant={diffSplitMode ? 'secondary' : 'ghost'}
          size="icon-sm"
          className="hidden md:inline-flex"
          onClick={() => setDiffSplitMode(!diffSplitMode)}
          aria-label={diffSplitMode ? 'Unified mode' : 'Split mode'}
          title={diffSplitMode ? 'Unified mode' : 'Split mode'}
        >
          <Columns2 className="h-4 w-4" />
        </Button>
        <Button
          variant={showFileTree ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={onToggleFileTree}
          aria-label={showFileTree ? 'Hide file tree' : 'Show file tree'}
          title={showFileTree ? 'Hide file tree' : 'Show file tree'}
        >
          {showFileTree ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Panel menu" title="Panel menu">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRefresh} disabled={!cwd || gitLoading}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDiffWordWrap(!diffWordWrap)}>
              {diffWordWrap ? 'Disable word wrap' : 'Enable word wrap'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
