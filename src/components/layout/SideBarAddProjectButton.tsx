import { open } from '@tauri-apps/plugin-dialog';
import { FolderPlus } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export function SideBarAddProjectButton() {
  const { addProject, setCwd } = useWorkspaceStore();

  const handleAddProject = useCallback(async () => {
    const projectPath = await open({ directory: true, multiple: false });
    if (!projectPath || Array.isArray(projectPath)) return;
    addProject(projectPath);
    setCwd(projectPath);
  }, [addProject, setCwd]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title="Add new project"
      onClick={handleAddProject}
    >
      <FolderPlus className="h-4 w-4" />
    </Button>
  );
}
