import { open } from '@tauri-apps/plugin-dialog';
import { FolderPlus } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BrowserProjects } from '@/features/ProjectSelector';
import { isDesktopTauri } from '@/hooks/runtime';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export function SideBarAddProjectButton() {
  const { addProject, cwd, setCwd } = useWorkspaceStore();
  const [browserOpen, setBrowserOpen] = useState(false);

  const selectProject = useCallback(
    (projectPath: string) => {
      addProject(projectPath);
      setCwd(projectPath);
      setBrowserOpen(false);
    },
    [addProject, setCwd]
  );

  const handleAddProject = useCallback(async () => {
    if (!isDesktopTauri()) {
      setBrowserOpen(true);
      return;
    }

    const projectPath = await open({ directory: true, multiple: false });
    if (!projectPath || Array.isArray(projectPath)) return;
    selectProject(projectPath);
  }, [selectProject]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Add new project"
        onClick={handleAddProject}
      >
        <FolderPlus className="h-4 w-4" />
      </Button>
      <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
        <DialogContent size="xl" className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add new project</DialogTitle>
            <DialogDescription>Browse and select a folder to add as a project.</DialogDescription>
          </DialogHeader>
          <BrowserProjects cwd={cwd} onAddProject={selectProject} />
        </DialogContent>
      </Dialog>
    </>
  );
}
