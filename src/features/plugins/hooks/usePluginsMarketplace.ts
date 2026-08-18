import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  MarketplaceLoadErrorInfo,
  PluginDetail,
  PluginMarketplaceEntry,
  PluginSummary,
} from '@/bindings/v2';
import { toast } from '@/components/ui/use-toast';
import { pluginInstall, pluginList, pluginRead } from '@/services';
import { useAgentSettingsStore, useLayoutStore } from '@/stores';
import { useInputStore } from '@/stores/useInputStore';
import { usePluginsViewContext } from '../hooks';
import {
  dedupePluginEntries,
  type PluginEntry,
  pluginRequestTarget,
  preferredLocalSources,
} from './pluginTargets';
import { useExternalUrl } from './useExternalUrl';

/**
 * Process-wide cache of the last plugin/list result, so re-entering the view
 * (or coming back from a detail page) renders instantly instead of refetching
 * the remote catalog.
 */
let listCache: {
  marketplaces: PluginMarketplaceEntry[];
  errors: MarketplaceLoadErrorInfo[];
} | null = null;

/** Build a placeholder detail from a list summary so the detail page can render immediately. */
function summaryToDetail(marketplace: PluginMarketplaceEntry, plugin: PluginSummary): PluginDetail {
  return {
    marketplaceName: marketplace.name,
    marketplacePath: marketplace.path,
    summary: plugin,
    shareUrl: null,
    description: null,
    skills: [],
    hooks: [],
    apps: [],
    appTemplates: [],
    mcpServers: [],
    scheduledTasks: null,
  };
}

/**
 * Provides state and handlers for the marketplace view.
 *
 * The component passes an optional `refreshTrigger` prop; changing it forces a reload.
 */
export function usePluginsMarketplace(refreshTrigger = 0) {
  const [marketplaces, setMarketplaces] = useState<PluginMarketplaceEntry[]>(
    listCache?.marketplaces ?? []
  );
  const [errors, setErrors] = useState<MarketplaceLoadErrorInfo[]>(listCache?.errors ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const { setSelectedAgent } = useAgentSettingsStore();
  const { setView } = useLayoutStore();
  const { appendInputValue } = useInputStore();
  const { handlePluginDetail } = usePluginsViewContext();
  const { openExternalUrl } = useExternalUrl();

  const loadPlugins = useCallback(async (forceRefetch = false) => {
    setIsLoading(true);
    try {
      // forceRefetch also makes the app-server re-sync the curated marketplace
      // checkout under ~/.codex/.tmp instead of serving its in-memory catalog.
      const response = await pluginList({ forceRefetch });
      listCache = {
        marketplaces: response.marketplaces,
        errors: response.marketplaceLoadErrors,
      };
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

  /** Flip the installed flag locally so the list stays in sync without a full reload. */
  const markInstalled = useCallback((pluginId: string, installed: boolean) => {
    setMarketplaces((prev) => {
      const next = prev.map((m) => ({
        ...m,
        plugins: m.plugins.map((p) => (p.id === pluginId ? { ...p, installed } : p)),
      }));
      if (listCache) listCache = { ...listCache, marketplaces: next };
      return next;
    });
  }, []);

  const preferred = useMemo(() => preferredLocalSources(marketplaces), [marketplaces]);

  /** One entry per plugin, with duplicates across marketplaces collapsed. */
  const entries = useMemo(() => {
    const all: PluginEntry[] = [];
    for (const marketplace of marketplaces) {
      for (const plugin of marketplace.plugins) {
        all.push({ marketplace, plugin });
      }
    }
    return dedupePluginEntries(all);
  }, [marketplaces]);

  const handleInstall = useCallback(
    async (marketplace: PluginMarketplaceEntry, plugin: PluginSummary) => {
      const target = pluginRequestTarget(marketplace, plugin, preferred);
      if (!target) {
        toast({
          title: 'Install unavailable',
          description: 'This plugin cannot be addressed by the current marketplace.',
          variant: 'destructive',
        });
        return;
      }

      setInstallingPluginId(plugin.id);
      try {
        const response = await pluginInstall(target);

        const authTargets = response.appsNeedingAuth.filter((app) => app.installUrl);
        if (authTargets.length > 0) {
          await openExternalUrl(authTargets[0].installUrl!);
        }

        markInstalled(plugin.id, true);
        toast({
          title: authTargets.length > 0 ? 'Plugin installed, auth required' : 'Plugin installed',
          description:
            authTargets.length > 0
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
    [markInstalled, openExternalUrl, preferred]
  );

  const handleUsePlugin = useCallback(
    (plugin: PluginSummary) => {
      const pluginName = plugin.interface?.displayName ?? plugin.name;
      setSelectedAgent('codex');
      setView('agent');
      appendInputValue(`@${pluginName}`);
    },
    [appendInputValue, setSelectedAgent, setView]
  );

  const handleShowDetail = useCallback(
    async (marketplace: PluginMarketplaceEntry, plugin: PluginSummary) => {
      // Open immediately with what the list already knows, then fill in the rest.
      handlePluginDetail(summaryToDetail(marketplace, plugin));
      const target = pluginRequestTarget(marketplace, plugin, preferred);
      if (!target) return;
      try {
        const response = await pluginRead(target);
        handlePluginDetail(response.plugin);
      } catch (error) {
        // The detail page already shows what the list knows; a failed enrich
        // (e.g. the remote catalog 404s on this plugin) is not worth a toast.
        console.warn('Failed to load plugin details:', error);
      }
    },
    [handlePluginDetail, preferred]
  );

  const lastTrigger = useRef(refreshTrigger);
  useEffect(() => {
    // Serve the first render from cache; only hit the backend when there is
    // nothing cached or the user explicitly asked for a refresh.
    const refreshRequested = refreshTrigger !== lastTrigger.current;
    lastTrigger.current = refreshTrigger;
    if (listCache && !refreshRequested) return;
    void loadPlugins(refreshRequested);
  }, [loadPlugins, refreshTrigger]);

  const browseGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const groupsMap = new Map<string, PluginEntry[]>();
    entries.forEach(({ marketplace: m, plugin: p }) => {
      if (needle) {
        const haystack = [
          p.name,
          p.interface?.displayName ?? '',
          p.interface?.shortDescription ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return;
      }
      const category = p.interface?.category || 'Others';
      if (!groupsMap.has(category)) {
        groupsMap.set(category, []);
      }
      groupsMap.get(category)!.push({ marketplace: m, plugin: p });
    });
    return Array.from(groupsMap.entries()).sort(([a], [b]) => {
      if (a === 'Others') return 1;
      if (b === 'Others') return -1;
      return a.localeCompare(b);
    });
  }, [entries, query]);

  return {
    marketplaces,
    errors,
    isLoading,
    installingPluginId,
    query,
    setQuery,
    loadPlugins,
    handleInstall,
    handleUsePlugin,
    handleShowDetail,
    browseGroups,
  };
}
