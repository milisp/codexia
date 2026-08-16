import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CodexAuth } from './CodexAuth';

interface CodexAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CodexAuthDialog({ open, onOpenChange }: CodexAuthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">ChatGPT Login</DialogTitle>
        <CodexAuth onAuthenticated={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
