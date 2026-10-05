import { create } from 'zustand';

export type PluginsTab = 'Plugins' | 'Tools' | 'Skills' | 'Connectors';

/** Navigation only; connector definitions remain owned by their runtime. */
export const usePluginsNavigationStore = create<{
  mainTab: PluginsTab;
  connectorTarget: 'agent' | 'bots';
  setMainTab: (tab: PluginsTab) => void;
  setConnectorTarget: (target: 'agent' | 'bots') => void;
  openBotConnectors: () => void;
}>((set) => ({
  mainTab: 'Plugins',
  connectorTarget: 'agent',
  setMainTab: (mainTab) => set({ mainTab }),
  setConnectorTarget: (connectorTarget) => set({ connectorTarget }),
  openBotConnectors: () => set({ mainTab: 'Connectors', connectorTarget: 'bots' }),
}));
