import { ChevronRight, Ellipsis, ScrollText, SquarePen, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getFilename } from '@/utils/getFilename';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLayoutStore } from '@/stores';

type Props = {
  onNewAction: (project: string) => void;
  newActionTitle: (projectName: string) => string;
  renderList: (project: string) => React.ReactNode;
};

export function SideBarProjectList({ onNewAction, newActionTitle, renderList }: Props) {
  const { projects, removeProject, cwd, setCwd, setInstructionType } = useWorkspaceStore();
  const { setView } = useLayoutStore();

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const isOpen = (project: string) => expandedProjects[project] ?? true;
  const toggleProject = (project: string, open: boolean) =>
    setExpandedProjects((prev) => ({ ...prev, [project]: open }));

  const openAgentInstructions = (project: string) => {
    setCwd(project);
    setView('agents-md');
    setInstructionType('project');
  };

  return (
    <div className="flex min-h-0 w-full flex-col gap-2 px-2 pb-2">
      {projects.map((project) => (
        <Collapsible
          key={project}
          open={isOpen(project)}
          onOpenChange={(open) => toggleProject(project, open)}
          className="rounded-lg border border-sidebar-border bg-sidebar/30"
        >
          <div
            className={`flex items-center gap-1 rounded-t-lg px-2 py-1.5 text-xs transition-colors ${cwd === project
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            title={project}
          >
            <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1 text-left">
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen(project) ? 'rotate-90' : ''}`}
              />
              <span className="truncate font-medium">{getFilename(project) || project}</span>
            </CollapsibleTrigger>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={`Project actions for ${getFilename(project) || project}`}
                  className="shrink-0"
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => removeProject(project)}>
                  <X /> Remove
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAgentInstructions(project)}>
                  <ScrollText /> Instructions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon-xs"
              title={newActionTitle(getFilename(project) || project)}
              onClick={() => onNewAction(project)}
              className="shrink-0"
            >
              <SquarePen />
            </Button>
          </div>

          <CollapsibleContent>{renderList(project)}</CollapsibleContent>
        </Collapsible>
      ))}

      {projects.length === 0 && (
        <div className="rounded-lg border border-sidebar-border bg-sidebar/30 px-3 py-3 text-xs text-muted-foreground">
          No projects yet.
        </div>
      )}
    </div>
  );
}
