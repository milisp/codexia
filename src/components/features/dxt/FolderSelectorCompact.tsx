import { open } from '@tauri-apps/plugin-dialog';
import { ChevronDown, Folder } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores';

export function FolderSelectorCompact() {
  const { cwd, setCwd } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleBrowse = async () => {
    try {
      setIsLoading(true);
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath && typeof selectedPath === 'string') {
        setCwd(selectedPath);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const folderName = cwd ? cwd.split(/[/\\]/).pop() || cwd : null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-7 px-2 gap-1.5 transition-all duration-200 border border-transparent group rounded-md',
        'text-muted-foreground hover:text-foreground hover:bg-muted/80',
        cwd && [
          'bg-secondary/50 text-secondary-foreground border-secondary',
          'dark:bg-muted/40 dark:text-muted-foreground dark:border-muted-foreground/10',
          'hover:bg-secondary hover:border-secondary/80 dark:hover:bg-muted/60 dark:hover:border-muted-foreground/20 shadow-sm',
        ]
      )}
      onClick={handleBrowse}
      disabled={isLoading}
      title={cwd || 'Select Folder'}
    >
      <Folder className={cn('h-3.5 w-3.5', cwd && 'text-primary/70')} />
      {folderName ? (
        <>
          <span className="text-[11px] font-medium max-w-[100px] truncate">{folderName}</span>
          <ChevronDown className="h-3 w-3 opacity-40 group-hover:opacity-70 transition-opacity" />
        </>
      ) : (
        <span className="text-[11px]">Work in a folder</span>
      )}
    </Button>
  );
}
