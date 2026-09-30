import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getTelemetryStatus, setTelemetryConsent, type TelemetryStatus } from '@/lib/telemetry';
import { useBotUiStore } from '@/stores/useBotUiStore';

const PRIVACY_URL = 'https://github.com/milisp/codexia/blob/master/docs/PRIVACY.md';
const SHOW_DELAY_MS = 3000;

/**
 * One-time telemetry question, shown only once the machine has a bot (the
 * backend says so via `eligible`) and never answered before. The answer lives
 * in the backend, so every client shares it. Nothing is preselected. Closing it with Esc or
 * the overlay is not a choice: consent stays 'unset' and it is asked again at
 * the next launch (it is not re-shown during this session).
 */
export function TelemetryConsentDialog() {
  const { t } = useTranslation('settings');
  const botCount = useBotUiStore((s) => s.bots.length);
  const [status, setStatus] = useState<TelemetryStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const eligible = !!status && status.available && status.eligible && status.consent === 'unset';

  // Re-check when the bot count changes so the prompt follows the first bot.
  // biome-ignore lint/correctness/useExhaustiveDependencies: botCount is the trigger
  useEffect(() => {
    getTelemetryStatus()
      .then(setStatus)
      .catch(() => {});
  }, [botCount]);

  const answer = (consent: 'granted' | 'denied') => {
    setTelemetryConsent(consent)
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  return (
    <Dialog
      open={eligible && ready && !dismissed}
      onOpenChange={(open) => !open && setDismissed(true)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('telemetryDialogTitle')}</DialogTitle>
          <DialogDescription>{t('telemetryDialogBody')}</DialogDescription>
        </DialogHeader>
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline"
        >
          {t('telemetryLearnMore')}
        </a>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={() => answer('denied')}>
            {t('telemetryDecline')}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => answer('granted')}>
            {t('telemetryAccept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
