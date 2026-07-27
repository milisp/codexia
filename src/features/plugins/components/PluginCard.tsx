import { Loader2, MessageCircleCode, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { MarketplaceLoadErrorInfo, PluginSummary } from '@/bindings/v2';

interface PluginCardProps {
  plugin: PluginSummary;
  isInstalling?: boolean;
  isUninstalling?: boolean;
  canInstall?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onUse?: () => void;
  showManageActions?: boolean;
}

function getPluginIconPath(plugin: PluginSummary): string | null {
  const iface = plugin.interface;
  if (!iface) return null;

  // Prefer logo over composerIcon, and local over remote
  if (iface.logo) {
    return iface.logo;
  }
  if (iface.composerIcon) {
    return iface.composerIcon;
  }
  return null;
}

export function PluginCard({
  plugin,
  isInstalling,
  isUninstalling,
  canInstall,
  onInstall,
  onUninstall,
  onUse,
  showManageActions,
}: PluginCardProps) {
  const displayName = plugin.interface?.displayName ?? plugin.name;
  const description = plugin.interface?.shortDescription ?? plugin.name;
  const iconPath = getPluginIconPath(plugin);
  const iconSrc = iconPath ? convertFileSrc(iconPath) : null;

  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {iconSrc && (
              <img
                src={iconSrc}
                alt={`${displayName} icon`}
                className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="space-y-1">
              <CardTitle>{displayName}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {showManageActions ? (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title="Uninstall"
                disabled={isUninstalling}
                onClick={onUninstall}
              >
                {isUninstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            ) : plugin.installed ? (
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                title={`Use ${displayName}`}
                onClick={onUse}
              >
                <MessageCircleCode className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title={`Install ${displayName}`}
                disabled={!canInstall || isInstalling}
                onClick={onInstall}
              >
                {isInstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

interface MarketplaceErrorCardProps {
  error: MarketplaceLoadErrorInfo;
}

export function MarketplaceErrorCard({ error }: MarketplaceErrorCardProps) {
  return (
    <Card className="border-destructive/40 py-0">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-sm">Marketplace load error</CardTitle>
        <CardDescription>{error.marketplacePath}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-4 text-sm text-muted-foreground">
        {error.message}
      </CardContent>
    </Card>
  );
}