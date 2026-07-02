import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';

export function ProjectsSettings() {
  const { projects, setProjects, cwd, setCwd } = useWorkspaceStore();

  const moveProject = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= projects.length) {
      return;
    }
    const next = [...projects];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setProjects(next);
  };

  const deleteProject = (project: string) => {
    const next = projects.filter((item) => item !== project);
    setProjects(next);
    if (cwd === project) {
      setCwd(next[0] ?? '');
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium px-1">Projects</h3>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Sort projects</div>
            <p className="text-xs text-muted-foreground">
              Use arrows to reorder projects in sidebar. Delete removes it from the list.
            </p>
          </div>
          {projects.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              No projects yet.
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project, index) => (
                <div
                  key={project}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">
                      {getFilename(project) || project}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{project}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveProject(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveProject(index, 1)}
                    disabled={index === projects.length - 1}
                    title="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteProject(project)}
                    title="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
