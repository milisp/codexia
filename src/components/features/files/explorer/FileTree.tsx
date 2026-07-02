import { X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileTreeNode } from './FileTreeNode';
import type { FileTreeProps } from './types';
import { useFileTree } from './useFileTree';

export function FileTree({ folder, onFileSelect }: FileTreeProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const {
    treeContainerRef,
    root,
    displayRoot,
    activeExpanded,
    loadingNodes,
    loading,
    error,
    filterText,
    setFilterText,
    searching,
    searchError,
    isSearching,
    hasSearchResults,
    toggle,
    loadChildren,
  } = useFileTree(folder);

  const header = (
    <div className="shrink-0 px-2 pb-1 pt-2">
      <div className="space-y-1">
        <div className="relative">
          <Input
            ref={searchInputRef}
            placeholder="Filter files or folders…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-7 pr-7 text-sm"
          />
          {filterText && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setFilterText('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (!folder) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="px-2 pt-2 text-sm text-muted-foreground">No folder selected.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="px-2 pt-2 text-sm text-muted-foreground">Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="px-2 pt-2 text-sm text-destructive">{error}</div>
      </div>
    );
  }

  const visibleNodes = displayRoot?.children ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div
        ref={treeContainerRef}
        className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-2 py-1"
      >
        {!displayRoot ? (
          <div className="text-sm text-muted-foreground">No files found.</div>
        ) : (
          <>
            {isSearching && searching && (
              <div className="text-sm text-muted-foreground">Searching...</div>
            )}
            {isSearching && searchError && (
              <div className="text-sm text-destructive">{searchError}</div>
            )}
            {isSearching && !searching && !searchError && !hasSearchResults && (
              <div className="text-sm text-muted-foreground">No matching files or folders.</div>
            )}
            {(!isSearching || hasSearchResults) && (
              <div className="space-y-0.5">
                {visibleNodes.map((child) => (
                  <FileTreeNode
                    key={child.path}
                    node={child}
                    depth={0}
                    rootPath={root?.path}
                    activeExpanded={activeExpanded}
                    loadingNodes={loadingNodes}
                    onToggle={toggle}
                    onLoadChildren={loadChildren}
                    onFileSelect={onFileSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
