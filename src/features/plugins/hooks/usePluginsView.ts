import { useCallback, useEffect, useState } from 'react';
import type { PluginDetail } from '@/bindings/v2';
import { toast } from '@/components/ui/use-toast';
import {
  pluginInstall,
  pluginRead,
  pluginUninstall,
  readSkillGroups,
  type SkillGroupsConfig,
  writeSkillGroups,
} from '@/services';
import { useAgentSettingsStore, useLayoutStore, usePluginStore } from '@/stores';
import { useInputStore } from '@/stores/useInputStore';
import { pluginDetailRequestTarget, pluginUninstallId } from './pluginTargets';
import { useExternalUrl } from './useExternalUrl';

/** The four primary views shown by the left-side TabSwitcher. */
export type MainTab = 'Plugins' | 'Tools' | 'Skills';
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

  const { setSelectedAgent } = useAgentSettingsStore();
  const { setView } = useLayoutStore();
  const { appendInputValue } = useInputStore();

  const { skillScope: scope, setSkillScope: setScope } = usePluginStore();

  useEffect(() => {
    readSkillGroups()
      .then(setGroupsConfig)
      .catch(() => {});
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

  /** Flip the installed flag on the open detail page without waiting for a re-read. */
  const setSelectedInstalled = useCallback((installed: boolean) => {
    setSelectedPluginDetail((prev) =>
      prev ? { ...prev, summary: { ...prev.summary, installed } } : prev
    );
  }, []);

  const refreshSelectedPluginDetail = useCallback(async (plugin: PluginDetail) => {
    const target = pluginDetailRequestTarget(plugin);
    if (!target) return;
    try {
      const response = await pluginRead(target);
      setSelectedPluginDetail(response.plugin);
    } catch (error) {
      console.error('Failed to refresh plugin detail:', error);
    }
  }, []);

  const handlePluginInstall = useCallback(
    async (plugin: PluginDetail) => {
      const { summary } = plugin;
      const target = pluginDetailRequestTarget(plugin);
      if (!target) {
        toast({
          title: 'Install unavailable',
          description: 'This plugin cannot be addressed by the current marketplace.',
          variant: 'destructive',
        });
        return;
      }

      setInstallingPluginId(summary.id);
      try {
        const response = await pluginInstall(target);

        const authTargets = response.appsNeedingAuth.filter((app) => app.installUrl);
        if (authTargets.length > 0) {
          await openExternalUrl(authTargets[0].installUrl!);
        }

        setSelectedInstalled(true);
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
    [refreshSelectedPluginDetail, setSelectedInstalled, openExternalUrl]
  );

  const handlePluginUninstall = useCallback(
    async (plugin: PluginDetail) => {
      const { summary } = plugin;
      const pluginId = pluginUninstallId(summary);
      if (!pluginId) {
        toast({
          title: 'Uninstall failed',
          description: 'This plugin has no identifier to uninstall.',
          variant: 'destructive',
        });
        return;
      }
      setUninstallingPluginId(summary.id);
      try {
        await pluginUninstall({ pluginId });
        setSelectedInstalled(false);
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
    [refreshSelectedPluginDetail, setSelectedInstalled]
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
