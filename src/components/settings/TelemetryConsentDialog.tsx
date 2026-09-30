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
import { isTelemetryAvailable, track } from '@/lib/telemetry';
import { useSettingsStore } from '@/stores/settings/useSettingsStore';

const PRIVACY_URL = 'https://github.com/milisp/codexia/blob/master/docs/PRIVACY.md';
const SHOW_DELAY_MS = 3000;

/**
 * One-time telemetry question. Nothing is preselected. Closing it with Esc or
 * the overlay is not a choice: consent stays 'unset' and it is asked again at
 * the next launch (it is not re-shown during this session).
 */
export function TelemetryConsentDialog() {
  const { t } = useTranslation('settings');
  const consent = useSettingsStore((s) => s.telemetryConsent);
  const setConsent = useSettingsStore((s) => s.setTelemetryConsent);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const eligible = consent === 'unset' && isTelemetryAvailable();

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
          <Button variant="outline" className="flex-1" onClick={() => setConsent('denied')}>
            {t('telemetryDecline')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setConsent('granted');
              track('app_active');
            }}
          >
            {t('telemetryAccept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
