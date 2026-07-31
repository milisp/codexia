// Hook to manage plugin marketplaces logic for PluginsMarketplaceView

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useWorkspaceStore, useLayoutStore } from '@/stores';
import { useInputStore } from '@/stores/useInputStore';
import { pluginInstall, pluginList, pluginRead } from '@/services';

import type {
  MarketplaceLoadErrorInfo,
  PluginMarketplaceEntry,
  PluginSummary,
} from '@/bindings/v2';
import { usePluginsViewContext } from '../hooks';
import { useExternalUrl } from './useExternalUrl';

const { openExternalUrl } = useExternalUrl();

/**
 * Provides state and handlers for the marketplace view.
 *
 * The component passes an optional `refreshTrigger` prop; changing it forces a reload.
 */
export function usePluginsMarketplace(refreshTrigger = 0) {
  const [marketplaces, setMarketplaces] = useState<PluginMarketplaceEntry[]>([]);
  const [errors, setErrors] = useState<MarketplaceLoadErrorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);

  const { setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { appendInputValue } = useInputStore();
  const { handlePluginDetail } = usePluginsViewContext();

  // Load all marketplaces
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

        const authTargets = response.appsNeedingAuth.filter((app) => app.installUrl);
        if (authTargets.length > 0) {
          await openExternalUrl(authTargets[0].installUrl!);
        }

        // Refresh list after install
        await loadPlugins();
        toast({
          title: authTargets.length > 0 ? 'Plugin installed, auth required' : 'Plugin installed',
          description: authTargets.length > 0
            ? `${plugin.interface?.displayName ?? plugin.name} needs ${authTargets
              .map((app) => app.name)
              .join(', ')} authentication.`
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

  const handleUsePlugin = useCallback(
    (plugin: PluginSummary) => {
      const pluginName = plugin.interface?.displayName ?? plugin.name;
      setSelectedAgent('codex');
      setView('agent');
      appendInputValue(`@${pluginName}`);
    },
    [appendInputValue, setSelectedAgent, setView],
  );

  const handleShowDetail = useCallback(
    async (marketplace: PluginMarketplaceEntry, plugin: PluginSummary) => {
      try {
        const response = await pluginRead({
          marketplacePath: marketplace.path ?? null,
          remoteMarketplaceName: marketplace.path ? null : marketplace.name,
          pluginName: plugin.name,
        });
        handlePluginDetail(response.plugin);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: 'Failed to load plugin details',
          description: message,
          variant: 'destructive',
        });
      }
    },
    [handlePluginDetail],
  );

  // Reload when component mounts or refreshTrigger changes
  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins, refreshTrigger]);

  // Grouping logic (same as original component)
  const browseGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      { marketplace: PluginMarketplaceEntry; plugin: PluginSummary }[]
    >();
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
  }, [marketplaces]);

  return {
    marketplaces,
    errors,
    isLoading,
    installingPluginId,
    loadPlugins,
    handleInstall,
    handleUsePlugin,
    handleShowDetail,
    browseGroups,
  };
}
