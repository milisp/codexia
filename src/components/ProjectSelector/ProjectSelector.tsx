import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { ChevronDown, Folder, FolderPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BrowserProjects, WorkspaceProjects } from '@/components/ProjectSelector';
import { Button } from '@/components/ui/button';
import { Command } from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isDesktopTauri } from '@/hooks/runtime';
import { cn } from '@/lib/utils';
import { codexService } from '@/services/codexService';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';

type SelectorMode = 'workspace' | 'browse';

export function ProjectSelector() {
  const { cwd, setCwd, projects, addProject } = useWorkspaceStore();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [mode, setMode] = useState<SelectorMode>('workspace');

  const workspaceProjects = useMemo(() => projects.filter(Boolean), [projects]);

  const triggerText = useMemo(() => {
    if (cwd === '/' || !cwd) {
      return 'Select a folder';
    }
    return getFilename(cwd) || cwd;
  }, [cwd]);

  useEffect(() => {
    if (!popoverOpen) {
      return;
    }
    setMode('workspace');
  }, [popoverOpen]);

  async function selectProject(path: string) {
    try {
      addProject(path);
      setCwd(path);
      await codexService.setCurrentThread(null);
      setPopoverOpen(false);
    } catch (e) {
      console.error('Failed to select working directory:', e);
    }
  }

  async function handleAddProject() {
    if (isDesktopTauri()) {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === 'string') {
        await selectProject(selected);
      }
    } else {
      setMode('browse');
    }
  }

  return (
    <DropdownMenu open={popoverOpen} onOpenChange={setPopoverOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('flex max-w-[320px] items-center gap-2 truncate')}>
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{triggerText}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-fit p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b px-2 py-2">
            {mode !== 'browse' && (
              <Button variant="ghost" size="sm" onClick={() => void handleAddProject()}>
                <FolderPlus className="h-4 w-4" />
                Add New Project
              </Button>
            )}
          </div>

          {mode === 'browse' ? (
            <BrowserProjects onAddProject={selectProject} cwd={cwd} />
          ) : (
            <WorkspaceProjects
              projects={workspaceProjects}
              cwd={cwd}
              onSelectProject={selectProject}
            />
          )}
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
