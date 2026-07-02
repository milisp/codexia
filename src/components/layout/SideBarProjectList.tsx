import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FolderClosed,
  FolderOpen,
  ScrollText,
  SquarePen,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';

type Props = {
  onNewAction: (project: string) => void;
  newActionTitle: (projectName: string) => string;
  renderList: (project: string) => React.ReactNode;
};

export function SideBarProjectList({ onNewAction, newActionTitle, renderList }: Props) {
  const { projects, removeProject, setCwd, setInstructionType } = useWorkspaceStore();
  const { setView, expandedProjects, setProjectExpanded } = useLayoutStore();
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  const isOpen = (project: string) => expandedProjects[project] ?? true;
  const toggleProject = (project: string, open: boolean) => setProjectExpanded(project, open);

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
          className="bg-sidebar/30"
        >
          <div
            className="flex items-center gap-1 px-1 py-0.5 text-xs transition-colors hover:bg-foreground/10"
            title={project}
            onMouseEnter={() => setHoveredProject(project)}
            onMouseLeave={() => setHoveredProject(null)}
          >
            <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {isOpen(project) ? (
                <FolderOpen className={`h-3.5 w-3.5 shrink-0 transition-transform`} />
              ) : (
                <FolderClosed className={`h-3.5 w-3.5 shrink-0 transition-transform`} />
              )}
              <span className="truncate font-medium">{getFilename(project) || project}</span>
              {isOpen(project) ? (
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-opacity ${hoveredProject === project ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : (
                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 transition-opacity ${hoveredProject === project ? 'opacity-100' : 'opacity-0'}`}
                />
              )}
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
