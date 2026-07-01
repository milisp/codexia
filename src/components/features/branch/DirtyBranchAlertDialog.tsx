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

interface DirtyBranchAlertDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dirtyBranch: string | null;
  dirtyCount: number;
  onConfirm: (branch: string) => void;
  onCancel: () => void;
}

export function DirtyBranchAlertDialog({
  isOpen,
  onOpenChange,
  dirtyBranch,
  dirtyCount,
  onConfirm,
  onCancel,
}: DirtyBranchAlertDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard Uncommitted Changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have {dirtyCount} uncommitted {dirtyCount === 1 ? 'change' : 'changes'}. If you
            switch to Branch{' '}
            <span className="font-mono font-semibold text-foreground">{dirtyBranch}</span>, your
            local changes will be permanently lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (dirtyBranch) {
                onConfirm(dirtyBranch);
              }
            }}
          >
            Discard & Switch
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
