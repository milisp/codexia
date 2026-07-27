import { useCallback, useEffect, useState } from 'react';
import { readSkillGroups, type SkillGroupsConfig, writeSkillGroups } from '@/services';
import { usePluginStore } from '@/stores';

/** The four primary views shown by the left-side TabSwitcher. */
export type MainTab = 'Plugins' | 'Tools' | 'Skills' | 'MCP';
/** A full-screen overlay that replaces the main content; null means "no overlay". */
export type Overlay = 'manage' | 'add' | null;
export type ManageTab = 'Skills' | 'MCPs';
export type AddTab = 'MCP' | 'Skill';
export type SkillScope = 'user' | 'project';

/**
 * Holds all state, effects, and handlers for PluginsView.
 * Keeping this separate from the view lets the component stay presentational.
 */
export function usePluginsView() {
  const [mainTab, setMainTab] = useState<MainTab>('Plugins');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [manageTab, setManageTab] = useState<ManageTab>('MCPs');
  const [addTab, setAddTab] = useState<AddTab>('MCP');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [manageRefreshKey, setManageRefreshKey] = useState(0);
  const [groupsConfig, setGroupsConfig] = useState<SkillGroupsConfig>({ groups: [] });

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
  };
}
