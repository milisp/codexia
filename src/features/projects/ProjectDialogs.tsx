import { Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { AddFolderButton } from './AddFolderButton';
import { primaryRoot, rootPaths } from './projectModel';
import { useServerProjectsStore } from './useServerProjectsStore';

interface EditProjectDialogProps {
  projectId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Rename a project and manage its folders; the first folder is where new chats start. */
export function EditProjectDialog({ projectId, onOpenChange }: EditProjectDialogProps) {
  const project = useServerProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const { rename, addRoot, removeRoot, makePrimary } = useServerProjectsStore.getState();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const savedName = project?.name ?? '';
  useEffect(() => setName(savedName), [savedName]);

  if (!project) return null;
  const primary = primaryRoot(project);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(failure, { description: String(error) });
    } finally {
      setBusy(false);
    }
  };

  const saveName = () => {
    const next = name.trim();
    if (!next || next === project.name) return;
    void run(() => rename(project.id, next), 'Failed to rename project');
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription className="sr-only">
            Rename the project and manage its folders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              aria-label="Project name"
              placeholder="Project name"
            />
            <Button
              variant="outline"
              onClick={saveName}
              disabled={busy || !name.trim() || name.trim() === project.name}
            >
              Save
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Folders</span>
              <AddFolderButton
                disabled={busy}
                onPick={(path) => void run(() => addRoot(project, path), 'Failed to add folder')}
              />
            </div>
            {project.roots.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                No folders yet. Add one to start chats in this project.
              </p>
            ) : (
              <ul className="space-y-1">
                {rootPaths(project).map((path) => (
                  <li key={path} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs" title={path}>
                      {path}
                    </span>
                    {path === primary ? (
                      <Badge variant="secondary">Primary</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busy}
                        onClick={() =>
                          void run(() => makePrimary(project, path), 'Failed to change primary')
                        }
                      >
                        <Star /> Make primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove folder ${path}`}
                      title="Remove folder"
                      disabled={busy}
                      onClick={() =>
                        void run(() => removeRoot(project, path), 'Failed to remove folder')
                      }
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmProjectActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmProjectActionDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onOpenChange,
}: ConfirmProjectActionDialogProps) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      toast.error(`${title} failed`, { description: String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
