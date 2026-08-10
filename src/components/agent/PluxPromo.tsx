import { openUrl } from '@tauri-apps/plugin-opener';
import { ExternalLink, Lightbulb, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'plux-promo-dismissed';

/** One-line "Pro tip" hint for Plux, shown when no session is active. */
export function PluxPromo() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <Lightbulb className="h-3.5 w-3.5 shrink-0" />
      <span>
        Pro tip: double-tap Shift to capture text from any app, then send it into Codexia, ChatGPT,
        Claude or anywhere else.
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-6 shrink-0 gap-1 px-2 text-xs"
        onClick={() => void openUrl('https://milisp.dev/plux')}
      >
        Try Plux
        <ExternalLink className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100"
        title="Dismiss"
        onClick={dismiss}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
