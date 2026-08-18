import { ExternalLink, Lightbulb, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';

const DISMISS_KEY = 'plux-promo-dismissed';

/** One-line "Pro tip" hint for Plux, shown when no session is active. */
export function PluxPromo() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const { openExternalUrl } = useExternalUrl();

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="truncate text-foreground/90">
          Capture now with a shortcut. Turn it into a todo, send it to{' '}
          <span className="font-medium text-foreground">(ChatGPT / Claude / Codexia)</span> anytime.
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 gap-1 px-2.5 text-xs font-medium"
          onClick={() => void openExternalUrl('https://milisp.dev/plux')}
        >
          <span>Try Plux</span>
          <ExternalLink className="h-3 w-3 opacity-70" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground/70 hover:text-foreground"
          title="Dismiss"
          onClick={dismiss}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
