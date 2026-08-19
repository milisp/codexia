import { X } from 'lucide-react';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';
import { useTodoStore } from '@/stores/useTodoStore';

const PLUX_URL = 'https://milisp.dev/plux';

/**
 * Todos here capture from codexia. Capturing from anywhere else on the machine
 * is what plux does — stated once, quietly, where someone is already capturing.
 */
export function PluxUpsellLine() {
  const dismissed = useTodoStore((state) => state.upsellDismissed);
  const dismissUpsell = useTodoStore((state) => state.dismissUpsell);
  const { openExternalUrl } = useExternalUrl();

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-1 px-4 pb-2 text-[10px] text-muted-foreground">
      <button
        type="button"
        className="truncate text-left hover:text-foreground hover:underline"
        onClick={() => openExternalUrl(PLUX_URL)}
      >
        Capture from any app, with attachments and archive — plux
      </button>
      <button
        type="button"
        className="ml-auto shrink-0 rounded p-0.5 hover:bg-accent hover:text-foreground"
        onClick={dismissUpsell}
        title="Dismiss"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
