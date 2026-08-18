import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCodexStore } from '@/components/codex/stores/useCodexStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { memoryReset, threadMemoryModeSet } from '@/services';

type MemoriesDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function MemoriesDialog({ open, onClose }: MemoriesDialogProps) {
  const currentThreadId = useCodexStore((state) => state.currentThreadId);
  // There is no read API for the current memory mode, so this switch only
  // reflects changes made from this dialog during the session.
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleToggle = async (next: boolean) => {
    if (!currentThreadId) return;
    const previous = enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await threadMemoryModeSet({
        threadId: currentThreadId,
        mode: next ? 'enabled' : 'disabled',
      });
      toast.success(next ? 'Memory enabled for this thread' : 'Memory disabled for this thread');
    } catch (error) {
      setEnabled(previous);
      toast.error(`Failed to update memory mode: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await memoryReset();
      toast.success('All memories were reset');
    } catch (error) {
      toast.error(`Failed to reset memories: ${error}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Memories</DialogTitle>
          <DialogDescription>
            Control whether Codex records memories from this thread, and clear everything it has
            stored so far.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="memory-mode">Memory for this thread</Label>
            <p className="text-muted-foreground text-xs">
              {currentThreadId
                ? 'Applies going forward. The current mode cannot be read back, so this reflects your latest change only.'
                : 'Start or open a thread to change its memory mode.'}
            </p>
          </div>
          <Switch
            id="memory-mode"
            checked={enabled}
            disabled={!currentThreadId || saving}
            onCheckedChange={handleToggle}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <Label>Reset all memories</Label>
            <p className="text-muted-foreground text-xs">
              Permanently deletes every stored memory across all threads.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={resetting}>
                <Trash2 className="size-4" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all memories?</AlertDialogTitle>
                <AlertDialogDescription>
                  This wipes every memory Codex has stored. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
