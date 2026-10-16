import {
  Archive,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FolderClosed,
  FolderOpen,
  Pencil,
  ScrollText,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { Project } from '@/bindings/v2';
import { ThreadList } from '@/components/codex/thread/ThreadList';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { ConfirmProjectActionDialog, EditProjectDialog } from '@/features/projects/ProjectDialogs';
import { primaryRoot } from '@/features/projects/projectModel';
import { useServerProjectsStore } from '@/features/projects/useServerProjectsStore';
import { isPhone } from '@/hooks/runtime';
import { useLayoutStore } from '@/stores';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

const RECENT_ID = 'recent';

interface SideBarServerProjectsProps {
  /** Starts a chat in `cwd`, or in no project for `null`. */
  onNewChat: (cwd: string | null) => void;
}

type ProjectDialog = { kind: 'edit' | 'archive' | 'delete'; project: Project };

/** Codex tab: app-server projects with their chats, then the unassigned "Recent" chats. */
export function SideBarServerProjects({ onNewChat }: SideBarServerProjectsProps) {
  const projects = useServerProjectsStore((s) => s.projects);
  const { setView, expandedProjects, setProjectExpanded } = useLayoutStore();
  const { setInstructionType } = useAgentSettingsStore();
  const setCwd = useWorkspaceStore((s) => s.setCwd);
  const [dialog, setDialog] = useState<ProjectDialog | null>(null);
  const phone = isPhone();

  const isOpen = (id: string) => expandedProjects[id] ?? true;

  const openInstructions = (root: string) => {
    setCwd(root);
    setView('agents-md');
    setInstructionType('project');
  };

  const archiveChats = async (project: Project) => {
    const count = await useServerProjectsStore.getState().archiveChats(project.id);
    toast.success(count === 1 ? 'Archived 1 chat' : `Archived ${count} chats`);
  };

  return (
    <div className="flex min-h-0 w-full flex-col gap-2 px-2 pb-2">
      {projects.map((project) => {
        const root = primaryRoot(project);
        return (
          <Collapsible
            key={project.id}
            open={isOpen(project.id)}
            onOpenChange={(open) => setProjectExpanded(project.id, open)}
            className="bg-sidebar/30"
          >
            <div
              className="group flex items-center gap-1 px-1 py-0.5 text-xs transition-colors hover:bg-foreground/10"
              title={root ?? project.name}
            >
              <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {isOpen(project.id) ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <FolderClosed className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate font-medium">{project.name}</span>
                {isOpen(project.id) ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
                )}
              </CollapsibleTrigger>

              {/* Editing shapes the desktop's project list; a phone only mirrors it. */}
              {!phone && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={`Project actions for ${project.name}`}
                      aria-label={`Project actions for ${project.name}`}
                      className="shrink-0"
                    >
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'edit', project })}>
                      <Pencil /> Edit project
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'archive', project })}>
                      <Archive /> Archive chats
                    </DropdownMenuItem>
                    {root && (
                      <DropdownMenuItem onSelect={() => openInstructions(root)}>
                        <ScrollText /> Instructions
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDialog({ kind: 'delete', project })}
                    >
                      <Trash2 /> Delete project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="ghost"
                size="icon-xs"
                title={
                  root ? `Start new thread in ${project.name}` : 'Add a folder to start chats here'
                }
                aria-label={`Start new thread in ${project.name}`}
                disabled={!root}
                onClick={() => root && onNewChat(root)}
                className="shrink-0"
              >
                <SquarePen />
              </Button>
            </div>

            <CollapsibleContent>
              <ThreadList projectId={project.id} cwd={root ?? undefined} />
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <Collapsible
        open={isOpen(RECENT_ID)}
        onOpenChange={(open) => setProjectExpanded(RECENT_ID, open)}
        className="bg-sidebar/30"
      >
        <div className="group flex items-center gap-1 px-1 py-0.5 text-xs transition-colors hover:bg-foreground/10">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="truncate font-medium">Recent</span>
            {isOpen(RECENT_ID) ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
            )}
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon-xs"
            title="New chat"
            aria-label="New chat"
            onClick={() => onNewChat(null)}
            className="shrink-0"
          >
            <SquarePen />
          </Button>
        </div>
        <CollapsibleContent>
          <ThreadList projectId={null} />
        </CollapsibleContent>
      </Collapsible>

      <EditProjectDialog
        projectId={dialog?.kind === 'edit' ? dialog.project.id : null}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ConfirmProjectActionDialog
        open={dialog?.kind === 'archive'}
        title="Archive chats"
        description={`Archive every chat in ${dialog?.project.name ?? 'this project'}? Archived chats can be restored later.`}
        confirmLabel="Archive chats"
        onConfirm={() => (dialog ? archiveChats(dialog.project) : Promise.resolve())}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ConfirmProjectActionDialog
        open={dialog?.kind === 'delete'}
        title="Delete project"
        description={`Delete ${dialog?.project.name ?? 'this project'}? Its chats are kept and move to Recent; no folders are deleted.`}
        confirmLabel="Delete project"
        destructive
        onConfirm={() =>
          dialog ? useServerProjectsStore.getState().remove(dialog.project.id) : Promise.resolve()
        }
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </div>
  );
}
