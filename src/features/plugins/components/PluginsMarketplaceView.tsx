import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useWorkspaceStore, useLayoutStore } from '@/stores';
import { useInputStore } from '@/stores/useInputStore';
import {
  pluginInstall,
  pluginList,
  pluginUninstall,
} from '@/services';
import { PluginCard, MarketplaceErrorCard } from '@/features/plugins/components/PluginCard';
import type { MarketplaceLoadErrorInfo, PluginMarketplaceEntry, PluginSummary } from '@/bindings/v2';
import { isTauri } from '@/hooks/runtime';

async function openExternalUrl(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface PluginsMarketplaceViewProps {
  mode: 'browse' | 'manage';
  refreshTrigger?: number;
}

export function PluginsMarketplaceView({
  mode,
  refreshTrigger = 0,
}: PluginsMarketplaceViewProps) {
  const [marketplaces, setMarketplaces] = useState<PluginMarketplaceEntry[]>([]);
  const [errors, setErrors] = useState<MarketplaceLoadErrorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [uninstallingPluginId, setUninstallingPluginId] = useState<string | null>(null);

  const { setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { appendInputValue } = useInputStore();

  const loadPlugins = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await pluginList({});
      setMarketplaces(response.marketplaces);
      setErrors(response.marketplaceLoadErrors);
    } catch (error) {
      console.error('Failed to load plugins:', error);
      setMarketplaces([]);
      setErrors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInstall = useCallback(
    async (marketplace: PluginMarketplaceEntry, plugin: PluginSummary) => {
      if (!marketplace.path) {
        toast({
          title: 'Install unavailable',
          description: 'This plugin marketplace does not expose a local install path yet.',
          variant: 'destructive',
        });
        return;
      }

      setInstallingPluginId(plugin.id);
      try {
        const response = await pluginInstall({
          marketplacePath: marketplace.path,
          pluginName: plugin.name,
        });

        const authTargets = response.appsNeedingAuth.filter((app) => app.needsAuth && app.installUrl);
        if (authTargets.length > 0) {
          await openExternalUrl(authTargets[0].installUrl!);
        }

        await loadPlugins();
        toast({
          title: authTargets.length > 0 ? 'Plugin installed, auth required' : 'Plugin installed',
          description:
            authTargets.length > 0
              ? `${plugin.interface?.displayName ?? plugin.name} needs ${authTargets.map((app) => app.name).join(', ')} authentication.`
              : `${plugin.interface?.displayName ?? plugin.name} is ready in the composer.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: 'Install failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setInstallingPluginId(null);
      }
    },
    [loadPlugins],
  );

  const handleUninstall = useCallback(
    async (plugin: PluginSummary) => {
      setUninstallingPluginId(plugin.id);
      try {
        await pluginUninstall({
          pluginId: plugin.id,
        });
        await loadPlugins();
        toast({
          title: 'Plugin removed',
          description: `${plugin.interface?.displayName ?? plugin.name} was uninstalled.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: 'Uninstall failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setUninstallingPluginId(null);
      }
    },
    [loadPlugins],
  );

  const handleUsePlugin = useCallback(
    (plugin: PluginSummary) => {
      const pluginName = plugin.interface?.displayName ?? plugin.name;
      setSelectedAgent('codex');
      setView('agent');
      appendInputValue(`@${pluginName}`);
    },
    [appendInputValue, setSelectedAgent, setView],
  );

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins, refreshTrigger]);

  const browseGroups = useMemo(() => {
    if (mode !== 'browse') return [];

    const groupsMap = new Map<string, { marketplace: PluginMarketplaceEntry; plugin: PluginSummary }[]>();

    marketplaces.forEach((m) => {
      m.plugins.forEach((p) => {
        const category = p.interface?.category || 'Others';
        if (!groupsMap.has(category)) {
          groupsMap.set(category, []);
        }
        groupsMap.get(category)!.push({ marketplace: m, plugin: p });
      });
    });

    return Array.from(groupsMap.entries()).sort(([a], [b]) => {
      if (a === 'Others') return 1;
      if (b === 'Others') return -1;
      return a.localeCompare(b);
    });
  }, [marketplaces, mode]);

  const managedPlugins = useMemo(() => {
    if (mode !== 'manage') return [];
    return marketplaces.flatMap((m) => m.plugins.filter((p) => p.installed));
  }, [marketplaces, mode]);

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading plugins...</div>;
  }

  if (marketplaces.length === 0) {
    return (
      <div className="space-y-3 p-4">
        <Card className="py-0">
          <CardHeader className="px-5 py-4">
            <CardTitle>No plugins found</CardTitle>
            <CardDescription>
              No plugin marketplaces were returned by Codex app-server.
            </CardDescription>
          </CardHeader>
        </Card>
        {errors.map((error) => (
          <MarketplaceErrorCard
            key={`${error.marketplacePath}-${error.message}`}
            error={error}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-6">
        {mode === 'browse' ? (
          browseGroups.map(([category, items]) => (
            <section key={category} className="space-y-3">
              <h2 className="text-sm font-semibold">{category}</h2>

              <div className="grid gap-4 md:grid-cols-2">
                {items.map(({ marketplace, plugin }) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    isInstalling={installingPluginId === plugin.id}
                    canInstall={!!marketplace.path}
                    onInstall={() => handleInstall(marketplace, plugin)}
                    onUse={() => handleUsePlugin(plugin)}
                  />
                ))}
              </div>
            </section>
          ))
        ) : mode === 'manage' ? (
          <div className="grid gap-4 md:grid-cols-2">
            {managedPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                showManageActions
                isUninstalling={uninstallingPluginId === plugin.id}
                onUninstall={() => handleUninstall(plugin)}
              />
            ))}
            {managedPlugins.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                No plugins installed.
              </div>
            )}
          </div>
        ) : null}

        {errors.map((error) => (
          <MarketplaceErrorCard
            key={`${error.marketplacePath}-${error.message}`}
            error={error}
          />
        ))}
      </div>
    </div>
  );
}
