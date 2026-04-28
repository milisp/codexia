import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { P2PConnState } from '@/hooks/useP2PConnection';
import { useSettingsStore } from '@/stores/settings';
import { p2pSetStunServers } from '@/services/tauri/p2p';

const BILIBILI_STUN = 'stun.chat.bilibili.com:3478';

export function P2PStatusDialog({
  state,
  error,
  onRetry,
  onClose,
}: {
  state: P2PConnState;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { customStunServers, setCustomStunServers } = useSettingsStore();

  async function handleAddStunAndRetry() {
    if (!customStunServers.includes(BILIBILI_STUN)) {
      const updated = [...customStunServers, BILIBILI_STUN];
      setCustomStunServers(updated);
      await p2pSetStunServers(updated).catch(() => undefined);
    }
    onRetry();
  }

  const open = state === 'connecting' || state === 'offline' || state === 'error';
  const dismissable = state !== 'connecting';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && dismissable) onClose(); }}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        {state === 'connecting' ? (
          <>
            <DialogTitle className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Connecting to desktop
            </DialogTitle>
            <DialogDescription>
              Looking for your Mac running Codexia…
            </DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle>
              {state === 'offline' ? 'Desktop offline' : 'Connection failed'}
            </DialogTitle>
            <DialogDescription>
              {error ?? (state === 'offline'
                ? 'Open Codexia on your Mac and enable P2P.'
                : 'An unexpected error occurred.')}
            </DialogDescription>
            <Button size="sm" onClick={onRetry} className="w-full">
              Retry
            </Button>
            <Button size="sm" variant="outline" onClick={handleAddStunAndRetry} className="w-full text-xs">
              Add stun.chat.bilibili.com:3478 and retry
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
