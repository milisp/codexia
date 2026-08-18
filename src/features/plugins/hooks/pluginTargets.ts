import type { AbsolutePathBuf } from '@/bindings/AbsolutePathBuf';
import type { PluginDetail, PluginMarketplaceEntry, PluginSummary } from '@/bindings/v2';

/**
 * Request-target helpers ported from the codex TUI plugin catalog
 * (codex-rs/tui/src/chatwidget/plugin_catalog.rs).
 *
 * The app-server addresses a plugin by (marketplace, plugin name), but for
 * remote-catalog plugins "plugin name" is actually the remote plugin id, and
 * a plugin that also exists in a local marketplace must be addressed locally.
 * Getting this wrong is what makes plugin/read and plugin/install fail.
 */

export interface PluginRequestTarget {
  marketplacePath: AbsolutePathBuf | null;
  remoteMarketplaceName: string | null;
  pluginName: string;
}

export interface PluginEntry {
  marketplace: PluginMarketplaceEntry;
  plugin: PluginSummary;
}

interface PreferredLocalSource {
  marketplacePath: AbsolutePathBuf;
  pluginName: string;
  installed: boolean;
  installPolicy: PluginSummary['installPolicy'];
}

function isRemote(plugin: PluginSummary): boolean {
  return plugin.source?.type === 'remote';
}

function remoteIdentity(plugin: PluginSummary): string | null {
  return plugin.shareContext?.remotePluginId ?? plugin.remotePluginId ?? null;
}

/** Local marketplace copies of remote plugins, keyed by remote plugin id. */
export function preferredLocalSources(
  marketplaces: PluginMarketplaceEntry[]
): Map<string, PreferredLocalSource> {
  const sources = new Map<string, PreferredLocalSource>();
  marketplaces.forEach((marketplace) => {
    const marketplacePath = marketplace.path;
    if (!marketplacePath) return;
    marketplace.plugins.forEach((plugin) => {
      if (isRemote(plugin)) return;
      const remoteId = plugin.shareContext?.remotePluginId;
      if (!remoteId || sources.has(remoteId)) return;
      sources.set(remoteId, {
        marketplacePath,
        pluginName: plugin.name,
        installed: plugin.installed,
        installPolicy: plugin.installPolicy,
      });
    });
  });
  return sources;
}

/**
 * Resolve how to address a plugin in plugin/read and plugin/install.
 * Returns null when the plugin cannot be addressed (details unavailable).
 */
export function pluginRequestTarget(
  marketplace: PluginMarketplaceEntry,
  plugin: PluginSummary,
  preferred: Map<string, PreferredLocalSource>
): PluginRequestTarget | null {
  const remoteId = remoteIdentity(plugin);

  if (isRemote(plugin) && remoteId) {
    const local = preferred.get(remoteId);
    if (
      local &&
      local.installed === plugin.installed &&
      local.installPolicy === plugin.installPolicy
    ) {
      return {
        marketplacePath: local.marketplacePath,
        remoteMarketplaceName: null,
        pluginName: local.pluginName,
      };
    }
  }

  const pluginName = isRemote(plugin) && remoteId ? remoteId : plugin.name;

  if (marketplace.path) {
    return { marketplacePath: marketplace.path, remoteMarketplaceName: null, pluginName };
  }
  if (remoteId) {
    return { marketplacePath: null, remoteMarketplaceName: marketplace.name, pluginName };
  }
  return null;
}

/** Same resolution, for an already-loaded detail page. */
export function pluginDetailRequestTarget(detail: PluginDetail): PluginRequestTarget | null {
  return pluginRequestTarget(
    {
      name: detail.marketplaceName,
      path: detail.marketplacePath,
      interface: null,
      plugins: [],
    },
    detail.summary,
    new Map()
  );
}

/** plugin/uninstall takes the remote id for remote plugins, the local id otherwise. */
export function pluginUninstallId(plugin: PluginSummary): string | null {
  if (isRemote(plugin)) return remoteIdentity(plugin);
  return plugin.id;
}

function isPreferredEntry(candidate: PluginEntry, existing: PluginEntry): boolean {
  const c = candidate.plugin;
  const e = existing.plugin;
  if (c.installed !== e.installed) return c.installed;

  const cAdmin = c.installPolicy === 'INSTALLED_BY_DEFAULT';
  const eAdmin = e.installPolicy === 'INSTALLED_BY_DEFAULT';
  if (cAdmin !== eAdmin) return cAdmin;

  const cLocalShare = !!c.shareContext && !isRemote(c);
  const eLocalShare = !!e.shareContext && !isRemote(e);
  if (cLocalShare !== eLocalShare) return cLocalShare;

  return !isRemote(c) && isRemote(e);
}

/**
 * Collapse entries that describe the same plugin, keeping the best source.
 * Without this the same plugin shows up once per marketplace that carries it,
 * which is why the list looked far longer than the official app's.
 */
export function dedupePluginEntries(entries: PluginEntry[]): PluginEntry[] {
  const deduped: PluginEntry[] = [];
  const indexByKey = new Map<string, number>();

  entries.forEach((entry) => {
    const key = remoteIdentity(entry.plugin);
    if (!key) {
      deduped.push(entry);
      return;
    }
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, deduped.length);
      deduped.push(entry);
    } else if (isPreferredEntry(entry, deduped[existingIndex])) {
      deduped[existingIndex] = entry;
    }
  });

  return deduped;
}
