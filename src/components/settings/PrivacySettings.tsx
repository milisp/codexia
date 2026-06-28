import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/stores/settings';
import { initPosthog, posthog } from '@/lib/posthog';

export function PrivacySettings() {
  const { analyticsEnabled, setAnalyticsEnabled } = useSettingsStore();

  function handleAnalyticsChange(enabled: boolean) {
    setAnalyticsEnabled(enabled);
    if (import.meta.env.DEV) return;
    if (enabled) {
      initPosthog();
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium px-1">Analytics</h3>
      <Card>
        <CardContent className="px-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Usage Analytics</div>
              <div className="text-xs text-muted-foreground">
                Help improve Codexia by sending anonymous usage data.
              </div>
            </div>
            <Switch
              checked={analyticsEnabled}
              onCheckedChange={handleAnalyticsChange}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}