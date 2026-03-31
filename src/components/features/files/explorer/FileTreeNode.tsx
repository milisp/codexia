import { FileIcon, defaultStyles } from 'react-file-icon';
import { ChevronDown, ChevronRight, FileText, FolderPlus, Plus } from 'lucide-react';
import { useLayoutStore, useWorkspaceStore } from '@/stores';
import { useInputStore } from '@/stores';
import { isTauri } from '@/hooks/runtime';
import { Button } from '@/components/ui/button';
import { getExtension, isLatexFile, isPdfFile, isOfficeFile } from './utils';
import type { FileNode } from './types';

type FileTreeNodeProps = {
  node: FileNode;
  depth: number;
  rootPath: string | undefined;
  activeExpanded: Set<string>;
  loadingNodes: Set<string>;
  onToggle: (path: string) => void;
  onLoadChildren: (node: FileNode) => void;
  onFileSelect?: (path: string) => void;
};

export function FileTreeNode({
  node,
  depth,
  rootPath,
  activeExpanded,
  loadingNodes,
  onToggle,
  onLoadChildren,
  onFileSelect,
}: FileTreeNodeProps) {
  const { selectedFilePath, setSelectedFilePath, addProject } = useWorkspaceStore();
  const { setRightPanelOpen, setActiveRightPanelTab } = useLayoutStore();
  const { appendInputValue } = useInputStore();
  const shouldUseSvgFileIcon = isTauri();

  const isDir = node.kind === 'dir';
  const isRoot = rootPath === node.path;
  const isExpanded = activeExpanded.has(node.path);
  const isLoadingChildren = loadingNodes.has(node.path);
  const extension = getExtension(node.name);
  const isSelectedFile = !isDir && selectedFilePath === node.path;

  const relativePath =
    rootPath && node.path.startsWith(rootPath)
      ? node.path.slice(rootPath.length).replace(/^[/\\]/, '') || '.'
      : node.path;

  const iconStyle =
    extension && extension in defaultStyles
      ? defaultStyles[extension as keyof typeof defaultStyles]
      : defaultStyles.txt;

  const handleClick = () => {
    if (isDir) {
      if (!isExpanded && !node.children) onLoadChildren(node);
      onToggle(node.path);
      return;
    }
    setSelectedFilePath(node.path);
    if (onFileSelect) {
      onFileSelect(node.path);
      return;
    }
    if (isLatexFile(extension) || isPdfFile(extension) || isOfficeFile(extension)) {
      setRightPanelOpen(true);
      setActiveRightPanelTab('files');
    } else {
      setRightPanelOpen(true);
      setActiveRightPanelTab('files');
    }
  };

  const handleInsert = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    appendInputValue(`\`${relativePath}\``);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        data-file-path={node.path}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={`group/file-row flex w-full items-center gap-2 rounded-md px-2 py-1 pr-3 text-left text-sm hover:bg-accent ${
          isSelectedFile ? 'bg-accent text-accent-foreground' : ''
        }`}
        style={{ paddingLeft: depth * 12 }}
      >
        {/* Chevron / insert-dir button */}
        {isDir ? (
          <span className="relative h-4 w-4 shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {!isRoot && (
              <Button
                onClick={handleInsert}
                variant="ghost"
                size="icon"
                title={`Insert ${node.name}`}
                className="absolute inset-0 h-4 w-4 min-h-0 min-w-0 rounded-sm border border-border bg-background p-0 text-foreground opacity-0 transition-opacity group-hover/file-row:opacity-100"
                aria-label={`Insert ${node.name}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* File icon / insert-file button */}
        {!isDir && (
          <span className="relative h-4 w-4 shrink-0">
            {shouldUseSvgFileIcon ? (
              <FileIcon extension={extension} {...iconStyle} />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
            {!isRoot && (
              <Button
                onClick={handleInsert}
                variant="ghost"
                size="icon"
                title={`Insert ${node.name}`}
                className="absolute inset-0 h-4 w-4 min-h-0 min-w-0 rounded-none p-0 text-muted-foreground opacity-0 transition-opacity group-hover/file-row:opacity-100"
                aria-label={`Insert ${node.name}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </span>
        )}

        <span className="whitespace-nowrap">{node.name}</span>

        {/* Add-as-project button (dirs only, hover) */}
        {isDir && !isRoot && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover/file-row:opacity-100"
            onClick={(e) => { e.stopPropagation(); addProject(node.path); }}
            title="Add as project"
            aria-label="Add as project"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        )}

        {isLoadingChildren && (
          <span className="ml-auto text-xs text-muted-foreground">Loading...</span>
        )}
      </div>

      {/* Recursive children */}
      {isDir && isExpanded &&
        node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            rootPath={rootPath}
            activeExpanded={activeExpanded}
            loadingNodes={loadingNodes}
            onToggle={onToggle}
            onLoadChildren={onLoadChildren}
            onFileSelect={onFileSelect}
          />
        ))}
    </div>
  );
}
