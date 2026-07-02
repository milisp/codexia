import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { initPosthog, posthog } from '@/lib/posthog';
import { useSettingsStore } from '@/stores/settings';

export function AnalyticsConsentDialog() {
  const { analyticsConsentShown, setAnalyticsConsentShown, setAnalyticsEnabled } =
    useSettingsStore();

  function handleAccept() {
    setAnalyticsEnabled(true);
    setAnalyticsConsentShown(true);
    if (!import.meta.env.DEV) {
      initPosthog();
      posthog.opt_in_capturing();
    }
  }

  function handleDecline() {
    setAnalyticsEnabled(false);
    setAnalyticsConsentShown(true);
  }

  return (
    <Dialog open={!analyticsConsentShown}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help improve Codexia</DialogTitle>
          <DialogDescription>
            We'd like to collect anonymous usage data to understand how Codexia is used and improve
            the experience. No personal information or code is ever collected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleDecline}>
            No thanks
          </Button>
          <Button onClick={handleAccept}>Allow analytics</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
