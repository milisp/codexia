import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useCCSettingsStore } from '@/stores/settings/useCCSettingsStore';

export function ClaudeSettings() {
  const { showPermissionCards, toggleShowPermissionCards } = useCCSettingsStore();

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-medium px-1">Permissions</h3>
        <Card>
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Show Permission Cards</div>
                <div className="text-xs text-muted-foreground">
                  Display permission requests at the bottom of the chat.
                </div>
              </div>
              <Switch checked={showPermissionCards} onCheckedChange={toggleShowPermissionCards} />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
