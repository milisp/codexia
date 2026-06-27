import { Check, Folder } from 'lucide-react';
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getFilename } from '@/utils/getFilename';

type WorkspaceProjectsProps = {
  projects: string[];
  cwd: string | null;
  onSelectProject: (path: string) => void | Promise<void>;
};

export function WorkspaceProjects({ projects, cwd, onSelectProject }: WorkspaceProjectsProps) {
  return (
    <CommandList className="max-h-[360px]">
      {projects.length > 0 && (
        <CommandGroup heading="Select project">
          {projects.map((projectPath) => {
            const isSelected = cwd === projectPath;
            return (
              <CommandItem
                key={projectPath}
                onSelect={() => void onSelectProject(projectPath)}
                className="flex items-center gap-2"
              >
                <Folder
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <span className="flex-1 truncate">{getFilename(projectPath) || projectPath}</span>
                {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}

      {projects.length === 0 && <CommandEmpty>No workspace projects found</CommandEmpty>}
    </CommandList>
  );
}
