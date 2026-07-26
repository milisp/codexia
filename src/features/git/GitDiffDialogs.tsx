import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GitDiffDialogsProps {
  bulkStageDialogOpen: boolean;
  bulkStagePathsCount: number;
  bulkStageLoading: boolean;
  revertConfirmOpen: boolean;
  revertLoading: boolean;
  onBulkStageDialogOpenChange: (open: boolean) => void;
  onRevertConfirmOpenChange: (open: boolean) => void;
  onBulkStageConfirm: () => void;
  onRevertConfirm: () => void;
}

export function GitDiffDialogs({
  bulkStageDialogOpen,
  bulkStagePathsCount,
  bulkStageLoading,
  revertConfirmOpen,
  revertLoading,
  onBulkStageDialogOpenChange,
  onRevertConfirmOpenChange,
  onBulkStageConfirm,
  onRevertConfirm,
}: GitDiffDialogsProps) {
  return (
    <>
      <Dialog open={bulkStageDialogOpen} onOpenChange={onBulkStageDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stage all files?</DialogTitle>
            <DialogDescription>
              {bulkStagePathsCount === 0
                ? 'No unstaged files are available in the current list.'
                : `This will stage ${bulkStagePathsCount} file${bulkStagePathsCount > 1 ? 's' : ''} from the current file tree.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onBulkStageDialogOpenChange(false)}
              disabled={bulkStageLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={onBulkStageConfirm}
              disabled={bulkStagePathsCount === 0 || bulkStageLoading}
            >
              {bulkStageLoading ? 'Staging...' : 'Stage all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={revertConfirmOpen} onOpenChange={onRevertConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert file changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard current changes for this file. You can not undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revertLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={revertLoading} onClick={onRevertConfirm}>
              {revertLoading ? 'Reverting...' : 'Revert'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
