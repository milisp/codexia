import { Badge } from '@/components/ui/badge';
import type { PluginDetail } from '@/bindings/v2';

interface AppTemplatesSectionProps {
  appTemplates: PluginDetail['appTemplates'];
}

export function AppTemplatesSection({ appTemplates }: AppTemplatesSectionProps) {
  if (!appTemplates || appTemplates.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">App Templates ({appTemplates.length})</h4>
      <div className="space-y-1">
        {appTemplates.map((template) => (
          <div
            key={template.templateId}
            className="flex items-start justify-between gap-3 p-2 rounded border bg-muted/30"
          >
            <div className="flex items-start gap-3">
              {template.logoUrl && (
                <img
                  src={template.logoUrl}
                  alt=""
                  className="h-8 w-8 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div>
                <p className="text-sm font-medium">{template.name}</p>
                {template.description && (
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                )}
              </div>
            </div>
            {template.reason && (
              <Badge variant="secondary" className="text-xs">
                {template.reason}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
