import { useCallback, useEffect, useState } from 'react';
import { readSkillGroups, type SkillGroupsConfig, writeSkillGroups } from '@/services';
import { pluginInstall, pluginRead, pluginUninstall } from '@/services';
import { usePluginStore, useWorkspaceStore, useLayoutStore } from '@/stores';
import { useInputStore } from '@/stores/useInputStore';
import { toast } from '@/components/ui/use-toast';
import type { PluginDetail } from '@/bindings/v2';
import { useExternalUrl } from './useExternalUrl';

/** The four primary views shown by the left-side TabSwitcher. */
export type MainTab = 'Plugins' | 'Tools' | 'Skills' | 'MCP';
/** A full-screen overlay that replaces the main content; null means "no overlay". */
export type Overlay = 'manage' | 'add' | 'detail' | null;
export type ManageTab = 'Skills' | 'MCPs';
export type AddTab = 'MCP' | 'Skill';
export type SkillScope = 'user' | 'project';

/**
 * Holds all state, effects, and handlers for PluginsView.
 * Keeping this separate from the view lets the component stay presentational.
 */
export function usePluginsView() {
  const { openExternalUrl } = useExternalUrl();
  const [mainTab, setMainTab] = useState<MainTab>('Plugins');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [manageTab, setManageTab] = useState<ManageTab>('MCPs');
  const [addTab, setAddTab] = useState<AddTab>('MCP');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [manageRefreshKey, setManageRefreshKey] = useState(0);
  const [groupsConfig, setGroupsConfig] = useState<SkillGroupsConfig>({ groups: [] });
  const [selectedPluginDetail, setSelectedPluginDetail] = useState<PluginDetail | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [uninstallingPluginId, setUninstallingPluginId] = useState<string | null>(null);

  const { setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { appendInputValue } = useInputStore();

  const {
    skillScope: scope,
    setSkillScope: setScope,
    selectedDxt,
    setSelectedDxt,
  } = usePluginStore();

  useEffect(() => {
    readSkillGroups()
      .then(setGroupsConfig)
      .catch(() => { });
  }, []);

  const saveGroups = useCallback(async (config: SkillGroupsConfig) => {
    setGroupsConfig(config);
    await writeSkillGroups(config);
  }, []);

  const handleMcpAdded = useCallback(() => {
    setManageRefreshKey((k) => k + 1);
    setOverlay('manage');
    setManageTab('MCPs');
  }, []);

  const handlePluginDetail = useCallback((plugin: PluginDetail | null) => {
    setSelectedPluginDetail(plugin);
    if (plugin) {
      setOverlay('detail');
    } else {
      setOverlay(null);
    }
  }, []);

  const refreshSelectedPluginDetail = useCallback(async (plugin: PluginDetail) => {
    try {
      const response = await pluginRead({
        marketplacePath: plugin.marketplacePath,
        remoteMarketplaceName: plugin.marketplacePath ? null : plugin.marketplaceName,
        pluginName: plugin.summary.name,
      });
      setSelectedPluginDetail(response.plugin);
    } catch (error) {
      console.error('Failed to refresh plugin detail:', error);
    }
  }, []);

  const handlePluginInstall = useCallback(
    async (plugin: PluginDetail) => {
      const { summary, marketplacePath } = plugin;
      if (!marketplacePath) {
        toast({
          title: 'Install unavailable',
          description: 'This plugin marketplace does not expose a local install path yet.',
          variant: 'destructive',
        });
        return;
      }

      setInstallingPluginId(summary.id);
      try {
        const response = await pluginInstall({
          marketplacePath,
          pluginName: summary.name,
        });

        const authTargets = response.appsNeedingAuth.filter(
          (app) => app.needsAuth && app.installUrl
        );
        if (authTargets.length > 0) {
          await openExternalUrl(authTargets[0].installUrl!);
        }

        await refreshSelectedPluginDetail(plugin);
        setRefreshTrigger((t) => t + 1);
        toast({
          title: authTargets.length > 0 ? 'Plugin installed, auth required' : 'Plugin installed',
          description:
            authTargets.length > 0
              ? `${summary.interface?.displayName ?? summary.name} needs ${authTargets.map((app) => app.name).join(', ')} authentication.`
              : `${summary.interface?.displayName ?? summary.name} is ready in the composer.`,
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
    [refreshSelectedPluginDetail]
  );

  const handlePluginUninstall = useCallback(
    async (plugin: PluginDetail) => {
      const { summary } = plugin;
      setUninstallingPluginId(summary.id);
      try {
        await pluginUninstall({ pluginId: summary.id });
        await refreshSelectedPluginDetail(plugin);
        setRefreshTrigger((t) => t + 1);
        toast({
          title: 'Plugin removed',
          description: `${summary.interface?.displayName ?? summary.name} was uninstalled.`,
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
    [refreshSelectedPluginDetail]
  );

  const handleUsePlugin = useCallback(
    (plugin: PluginDetail) => {
      const pluginName = plugin.summary.interface?.displayName ?? plugin.summary.name;
      setSelectedAgent('codex');
      setView('agent');
      appendInputValue(`@${pluginName}`);
    },
    [appendInputValue, setSelectedAgent, setView]
  );

  return {
    mainTab,
    setMainTab,
    overlay,
    setOverlay,
    manageTab,
    setManageTab,
    addTab,
    setAddTab,
    refreshTrigger,
    setRefreshTrigger,
    manageRefreshKey,
    setManageRefreshKey,
    groupsConfig,
    saveGroups,
    scope,
    setScope,
    selectedDxt,
    setSelectedDxt,
    handleMcpAdded,
    selectedPluginDetail,
    handlePluginDetail,
    installingPluginId,
    uninstallingPluginId,
    handlePluginInstall,
    handlePluginUninstall,
    handleUsePlugin,
  };
}
