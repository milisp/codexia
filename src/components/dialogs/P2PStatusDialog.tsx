import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import type { P2PConnState } from '@/hooks/useP2PConnection';

export function P2PStatusDialog({
  state,
  error,
  onRetry,
}: {
  state: P2PConnState;
  error: string | null;
  onRetry: () => void;
}) {
  const open = state === 'connecting' || state === 'offline' || state === 'error';
  return (
    <DialogPrimitive.Root open={open}>
      <DialogPortal>
        <DialogOverlay className="z-[200]" />
        <DialogPrimitive.Content className="bg-background fixed top-1/2 left-1/2 z-[201] w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-lg">
          {state === 'connecting' ? (
            <>
              <DialogPrimitive.Title className="flex items-center gap-2 text-lg font-semibold leading-none">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Connecting to desktop
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-muted-foreground mt-2 text-sm">
                Looking for your Mac running Codexia…
              </DialogPrimitive.Description>
            </>
          ) : (
            <>
              <DialogPrimitive.Title className="text-lg font-semibold leading-none">
                {state === 'offline' ? 'Desktop offline' : 'Connection failed'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-muted-foreground mt-2 text-sm">
                {error ?? (state === 'offline'
                  ? 'Open Codexia on your Mac and enable P2P.'
                  : 'An unexpected error occurred.')}
              </DialogPrimitive.Description>
              <Button size="sm" onClick={onRetry} className="mt-4 w-full">
                Retry
              </Button>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
