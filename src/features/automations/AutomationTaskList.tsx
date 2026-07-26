import { Check, ListFilter, Pause, Pencil, Play, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AutomationTask } from '@/services/tauri';
import { getFilename } from '@/utils/getFilename';
import { formatStartsIn, getNextRunAt } from './utils';

type SortKey = 'name' | 'newest';
type AgentFilter = 'codex' | 'cc';

type AutomationTaskListProps = {
  tasks: AutomationTask[];
  isLoading: boolean;
  now: Date;
  selectedTaskId: string | null;
  togglingPauseTaskId: string | null;
  onCreateNew: () => void;
  onSelectTask: (task: AutomationTask) => void;
  onEditTask: (task: AutomationTask) => void;
  onTogglePause: (task: AutomationTask) => void;
};

export function AutomationTaskList({
  tasks,
  isLoading,
  now,
  selectedTaskId,
  togglingPauseTaskId,
  onCreateNew,
  onSelectTask,
  onEditTask,
  onTogglePause,
}: AutomationTaskListProps) {
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('codex');
  const [taskQuery, setTaskQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const tasksInAgent = useMemo(
    () => tasks.filter((task) => task.agent === agentFilter),
    [tasks, agentFilter]
  );
  const codexCount = useMemo(() => tasks.filter((task) => task.agent === 'codex').length, [tasks]);
  const ccCount = useMemo(() => tasks.filter((task) => task.agent === 'cc').length, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = taskQuery.trim().toLowerCase();
    const filtered = tasksInAgent.filter((task) => {
      if (!query) return true;
      const projectsText = task.projects.join(' ').toLowerCase();
      return task.name.toLowerCase().includes(query) || projectsText.includes(query);
    });

    filtered.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered;
  }, [tasksInAgent, taskQuery, sortKey]);

  return (
    <div className="h-fit rounded-md border bg-card">
      <div className="px-2 pb-1.5 pt-2">
        <div className="flex items-center justify-between gap-2 pb-1">
          <Tabs
            value={agentFilter}
            onValueChange={(value) => setAgentFilter(value as AgentFilter)}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="codex">Codex ({codexCount})</TabsTrigger>
              <TabsTrigger value="cc">Claude ({ccCount})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open task filters">
                  <ListFilter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 space-y-2 p-2">
                <div className="space-y-1">
                  <p className="px-1 text-xs font-medium text-muted-foreground">Sort by</p>
                  <Button
                    type="button"
                    variant={sortKey === 'newest' ? 'secondary' : 'ghost'}
                    className="h-8 w-full justify-between px-2"
                    onClick={() => {
                      setSortKey('newest');
                      setIsFilterOpen(false);
                    }}
                  >
                    <span className="text-xs">Newest</span>
                    {sortKey === 'newest' && <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant={sortKey === 'name' ? 'secondary' : 'ghost'}
                    className="h-8 w-full justify-between px-2"
                    onClick={() => {
                      setSortKey('name');
                      setIsFilterOpen(false);
                    }}
                  >
                    <span className="text-xs">Name</span>
                    {sortKey === 'name' && <Check className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={onCreateNew} aria-label="New automation">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={taskQuery}
              onChange={(event) => setTaskQuery(event.target.value)}
              placeholder="Search task name or project..."
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5 px-2 pb-2 pt-1.5">
        {isLoading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading automations...</p>
        ) : filteredTasks.length === 0 ? (
          <div className="space-y-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {tasks.length === 0 ? (
              <p>No automations yet.</p>
            ) : tasksInAgent.length === 0 ? (
              <p>No automations for this agent filter.</p>
            ) : (
              <p>No tasks match the current search filter.</p>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const nextRun = getNextRunAt(task.schedule, now);
            const countdown = formatStartsIn(nextRun, now);
            const visibleProjects =
              task.projects.length > 0 ? task.projects.slice(0, 2) : ['all-projects'];
            const hiddenCount = task.projects.length > 2 ? task.projects.length - 2 : 0;
            const isSelected = selectedTaskId === task.id;

            return (
              <div
                key={task.id}
                className={`group flex w-full items-center gap-2 rounded-md border p-2 transition-colors hover:bg-accent/30 ${isSelected ? 'border-primary/40 bg-accent/40' : ''}`}
              >
                <Button
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 justify-start p-0 text-left hover:bg-transparent"
                  onClick={() => onSelectTask(task)}
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{task.name}</p>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1">
                    {visibleProjects.map((project) => (
                      <Badge key={project} variant="secondary" className="max-w-[120px] truncate">
                        {getFilename(project) || project}
                      </Badge>
                    ))}
                    {hiddenCount > 0 && <Badge variant="outline">+{hiddenCount}</Badge>}
                  </div>
                </Button>

                <div className="flex shrink-0 items-center gap-1">
                  <div className="relative h-7 w-16">
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-nowrap text-center text-xs text-muted-foreground transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
                      {task.paused ? <Badge>paused</Badge> : `in ${countdown}`}
                    </p>
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        disabled={togglingPauseTaskId === task.id}
                        onClick={() => onTogglePause(task)}
                        aria-label={task.paused ? 'Resume automation' : 'Pause automation'}
                      >
                        {task.paused ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditTask(task);
                        }}
                        aria-label="Edit automation"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
