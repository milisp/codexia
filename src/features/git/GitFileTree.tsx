import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Minus, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DiffSection, TreeNode } from './types';
import { statusColorByText, statusTextForSection } from './utils';

interface GitFileTreeProps {
  fileTree: TreeNode[];
  selectedDiffPath: string | null;
  selectedDiffSection: DiffSection;
  collapsedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectPath: (section: DiffSection, path: string) => void;
  onStage: (paths: string[]) => Promise<void>;
  onUnstage: (paths: string[]) => Promise<void>;
}

export function GitFileTree({
  fileTree,
  selectedDiffPath,
  selectedDiffSection,
  collapsedFolders,
  onToggleFolder,
  onSelectPath,
  onStage,
  onUnstage,
}: GitFileTreeProps) {
  if (fileTree.length === 0) {
    return null;
  }

  const renderTreeNode = (node: TreeNode, depth: number): React.ReactNode => {
    if (node.type === 'folder') {
      const collapsed = collapsedFolders.has(node.path);
      return (
        <div key={node.path}>
          <button
            type="button"
            className="w-full flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-accent/40"
            style={{ paddingLeft: depth * 12 + 8 }}
            onClick={() => onToggleFolder(node.path)}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {collapsed ? (
              <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {!collapsed && node.children.map((child) => renderTreeNode(child, depth + 1))}
        </div>
      );
    }

    const active = selectedDiffPath === node.path;
    const status = statusTextForSection(node.entry, selectedDiffSection);
    return (
      <div
        key={node.path}
        className={`group flex items-center gap-2 rounded px-2 py-1 text-xs border cursor-pointer ${active ? 'bg-accent border-accent-foreground/20' : 'border-transparent hover:bg-accent/40'}`}
        style={{ paddingLeft: depth * 12 + 20 }}
        onClick={() => onSelectPath(selectedDiffSection, node.path)}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate flex-1" title={node.path}>
          {node.name}
        </span>
        <div className="relative shrink-0">
          <Badge
            variant="outline"
            className={`font-mono px-1.5 transition-opacity group-hover:opacity-0 ${statusColorByText(status)}`}
          >
            {status}
          </Badge>
          <Button
            size="icon-xs"
            variant="ghost"
            className="absolute inset-0 h-full w-full p-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
            title={selectedDiffSection === 'staged' ? 'Unstage file' : 'Stage file'}
            aria-label={selectedDiffSection === 'staged' ? 'Unstage file' : 'Stage file'}
            onClick={(event) => {
              event.stopPropagation();
              if (selectedDiffSection === 'staged') {
                void onUnstage([node.path]);
              } else {
                void onStage([node.path]);
              }
            }}
          >
            {selectedDiffSection === 'staged' ? (
              <Minus className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  return <>{fileTree.map((node) => renderTreeNode(node, 0))}</>;
}
