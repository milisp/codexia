// Confirmation dialog for deleting a session.
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

interface DeleteSessionDialogProps {
  pendingDeleteId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (sessionId: string) => void;
}

export function DeleteSessionDialog({
  pendingDeleteId,
  onOpenChange,
  onConfirm,
}: DeleteSessionDialogProps) {
  return (
    <AlertDialog open={!!pendingDeleteId} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete session?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The session and its history will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (pendingDeleteId) {
                onConfirm(pendingDeleteId);
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
