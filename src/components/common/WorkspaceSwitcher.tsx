import { open } from '@tauri-apps/plugin-dialog';
import { Check, ChevronDown, FolderOpen, FolderPlus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { type ThreadCwdMode, useConfigStore } from '@/components/codex/stores';
import { BrowserProjects } from '@/components/ProjectSelector';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isDesktopTauri } from '@/hooks/runtime';
import { useCCStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { BranchSwitcher } from '../features/branch';
import { AgentWorkspaceSelect } from './AgentWorkspaceSelect';

export function WorkspaceSwitcher() {
  const [projectOpen, setProjectOpen] = useState(false);
  const [browseMode, setBrowseMode] = useState(false);
  const { cwd, projects, addProject, setCwd, selectedAgent } = useWorkspaceStore();
  const { options, updateOptions } = useCCStore();
  const { threadCwdMode, setThreadCwdMode } = useConfigStore();

  const handleSelectProject = useCallback(
    (project: string) => {
      setCwd(project);
      setProjectOpen(false);
    },
    [setCwd]
  );

  async function handleSelectBrowseProject(path: string) {
    addProject(path);
    setCwd(path);
    setBrowseMode(false);
    setProjectOpen(false);
  }

  const handleChooseFolder = useCallback(async () => {
    if (isDesktopTauri()) {
      const projectPath = await open({ directory: true, multiple: false });
      if (!projectPath || Array.isArray(projectPath)) return;
      addProject(projectPath as string);
      setCwd(projectPath as string);
      setProjectOpen(false);
    } else {
      setBrowseMode(true);
    }
  }, [addProject, setCwd, cwd]);

  const repoLabel = cwd ? (cwd.split('/').filter(Boolean).pop() ?? cwd) : 'No project';

  return (
    <div className="flex items-center gap-1 font-mono py-2">
      {/* Left: Project selector */}
      <DropdownMenu
        open={projectOpen}
        onOpenChange={(o) => {
          setProjectOpen(o);
          if (!o) setBrowseMode(false);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-1 px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span>{repoLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-fix">
          {browseMode ? (
            <BrowserProjects cwd={cwd} onAddProject={handleSelectBrowseProject} />
          ) : (
            <>
              <div className="max-h-60 overflow-y-auto p-1">
                {projects.map((project) => {
                  const isCurrent = project === cwd;
                  const folderName = project.split('/').filter(Boolean).pop() ?? project;
                  return (
                    <DropdownMenuItem
                      key={project}
                      asChild
                      onSelect={(e) => {
                        e.preventDefault();
                        handleSelectProject(project);
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-xs font-mono focus-visible:ring-0"
                      >
                        <div className="flex w-full justify-between items-center">
                          <span className="font-medium">{folderName}</span>
                          {isCurrent ? (
                            <Check className="h-3 w-3 shrink-0 text-primary" />
                          ) : (
                            <span className="h-3 w-3 shrink-0" />
                          )}
                        </div>
                      </Button>
                    </DropdownMenuItem>
                  );
                })}
              </div>
              <div className="border-t p-1">
                <DropdownMenuItem
                  asChild
                  onSelect={(e) => {
                    e.preventDefault();
                    handleChooseFolder();
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-2 text-xs text-muted-foreground focus-visible:ring-0"
                  >
                    <FolderPlus className="h-3 w-3 shrink-0" />
                    <span>Choose a different folder</span>
                  </Button>
                </DropdownMenuItem>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedAgent === 'cc' ? (
        <AgentWorkspaceSelect
          value={options.worktreeMode ?? 'local'}
          onValueChange={(v: ThreadCwdMode) => updateOptions({ worktreeMode: v })}
        />
      ) : (
        <AgentWorkspaceSelect
          value={threadCwdMode}
          onValueChange={(v: ThreadCwdMode) => setThreadCwdMode(v)}
        />
      )}

      <BranchSwitcher cwd={cwd} />
    </div>
  );
}
