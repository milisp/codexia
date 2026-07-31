import type { PluginDetail } from '@/bindings/v2';

interface AppsSectionProps {
  apps: PluginDetail['apps'];
}

export function AppsSection({ apps }: AppsSectionProps) {
  if (!apps || apps.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">Apps ({apps.length})</h4>
      <div className="space-y-1">
        {apps.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between p-2 rounded border bg-muted/30"
          >
            <div>
              <p className="text-sm font-medium">{app.name}</p>
              {app.description && (
                <p className="text-xs text-muted-foreground">{app.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
