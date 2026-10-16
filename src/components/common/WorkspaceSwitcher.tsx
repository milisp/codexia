import { open } from '@tauri-apps/plugin-dialog';
import { Check, ChevronDown, Clock3, FolderOpen, FolderPlus, FolderX, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ThreadCwdMode, useConfigStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { BrowserProjects } from '@/features/ProjectSelector';
import { isDesktopTauri } from '@/hooks/runtime';
import { useSessionProjects } from '@/hooks/useSessionProjects';
import { cn } from '@/lib/utils';
import { useCCStore } from '@/stores';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { BranchSwitcher } from '../../features/branch';
import { AgentWorkspaceSelect } from './AgentWorkspaceSelect';

const RECENT_PREVIEW = 5;

const folderName = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

interface ProjectMenuListProps {
  cwd: string | null;
  projects: string[];
  onSelect: (path: string) => void;
  onChooseFolder: () => void;
  onClear: () => void;
}

/** Filterable list of added projects and folders from recent sessions. */
function ProjectMenuList({
  cwd,
  projects,
  onSelect,
  onChooseFolder,
  onClear,
}: ProjectMenuListProps) {
  const [filter, setFilter] = useState('');
  const [showAllRecent, setShowAllRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The menu focuses its own container on open, after child effects run;
  // take focus back on the next frame so typing goes to the filter.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  // Mounted only while the menu is open, so this rescans sessions on each open.
  const { projects: sessionProjects } = useSessionProjects();

  const query = filter.trim().toLowerCase();
  const visibleProjects = useMemo(
    () => projects.filter((path) => path.toLowerCase().includes(query)),
    [projects, query]
  );
  // Folders from existing Codex / Claude Code sessions that aren't added yet.
  const recentProjects = useMemo(() => {
    const added = new Set(projects);
    return sessionProjects.filter((path) => !added.has(path) && path.toLowerCase().includes(query));
  }, [projects, sessionProjects, query]);
  // A search shows every match; otherwise keep the recent list short.
  const collapsible = !query && recentProjects.length > RECENT_PREVIEW;
  const visibleRecent =
    collapsible && !showAllRecent ? recentProjects.slice(0, RECENT_PREVIEW) : recentProjects;
  const noMatches = visibleProjects.length === 0 && recentProjects.length === 0;

  return (
    <>
      <div className="relative border-b p-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          // Keep typing in the field instead of the menu's typeahead.
          onKeyDown={(e) => {
            if (e.key !== 'Escape' && e.key !== 'ArrowDown') e.stopPropagation();
          }}
          placeholder="Filter projects"
          aria-label="Filter projects"
          className="h-7 border-0 pl-7 text-xs shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="max-h-80 overflow-y-auto p-1">
        {query && noMatches && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No matching projects
          </p>
        )}
        {visibleProjects.length > 0 && <DropdownMenuLabel>Projects</DropdownMenuLabel>}
        {visibleProjects.map((project) => (
          <DropdownMenuItem
            key={project}
            title={project}
            className="text-xs"
            onSelect={() => onSelect(project)}
          >
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate font-medium">{folderName(project)}</span>
            {project === cwd && <Check className="h-3 w-3 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
        {recentProjects.length > 0 && <DropdownMenuLabel>From recent sessions</DropdownMenuLabel>}
        {visibleRecent.map((project) => (
          <DropdownMenuItem
            key={project}
            title={project}
            className="text-xs"
            onSelect={() => onSelect(project)}
          >
            <Clock3 className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{folderName(project)}</span>
          </DropdownMenuItem>
        ))}
        {collapsible && (
          <DropdownMenuItem
            className="text-xs text-muted-foreground"
            onSelect={(e) => {
              e.preventDefault();
              setShowAllRecent((v) => !v);
            }}
          >
            <ChevronDown className={cn('h-3 w-3 shrink-0', showAllRecent && 'rotate-180')} />
            {showAllRecent ? 'Show less' : `Show ${recentProjects.length - RECENT_PREVIEW} more`}
          </DropdownMenuItem>
        )}
      </div>
      <div className="border-t p-1">
        <DropdownMenuItem
          className="text-xs text-muted-foreground"
          onSelect={(e) => {
            e.preventDefault();
            onChooseFolder();
          }}
        >
          <FolderPlus className="h-3 w-3 shrink-0" />
          Choose a folder…
        </DropdownMenuItem>
        {cwd && (
          <DropdownMenuItem className="text-xs text-muted-foreground" onSelect={onClear}>
            <FolderX className="h-3 w-3 shrink-0" />
            No project
          </DropdownMenuItem>
        )}
      </div>
    </>
  );
}

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [browseMode, setBrowseMode] = useState(false);
  const { cwd, projects, addProject, setCwd } = useWorkspaceStore();
  const { selectedAgent } = useAgentSettingsStore();
  const { options, updateOptions } = useCCStore();
  const { threadCwdMode, setThreadCwdMode } = useConfigStore();

  // Picking a folder from recent sessions also adds it as a project.
  const handleSelectProject = useCallback(
    (project: string) => {
      addProject(project);
      setCwd(project);
      setBrowseMode(false);
      setProjectOpen(false);
    },
    [addProject, setCwd]
  );

  const handleChooseFolder = useCallback(async () => {
    if (isDesktopTauri()) {
      const projectPath = await open({ directory: true, multiple: false });
      if (typeof projectPath === 'string') handleSelectProject(projectPath);
    } else {
      setBrowseMode(true);
    }
  }, [handleSelectProject]);

  const repoLabel = cwd ? folderName(cwd) : 'No project';

  return (
    <div className={cn('flex items-center gap-1 font-mono', className)}>
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
        <DropdownMenuContent side="top" align="start" className="w-64">
          {browseMode ? (
            <BrowserProjects cwd={cwd} onAddProject={handleSelectProject} />
          ) : (
            <ProjectMenuList
              cwd={cwd}
              projects={projects}
              onSelect={handleSelectProject}
              onChooseFolder={() => handleChooseFolder()}
              onClear={() => setCwd(null)}
            />
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
