import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SkillScope } from '@/services';

export type McpScope = 'local' | 'project' | 'global';

type PluginState = {
  skillScope: SkillScope;
  setSkillScope: (scope: SkillScope) => void;
  mcpScope: McpScope;
  setMcpScope: (scope: McpScope) => void;
  selectedDxt: { user: string; repo: string } | null;
  setSelectedDxt: (dxt: { user: string; repo: string } | null) => void;
};

export const usePluginStore = create<PluginState>()(
  persist(
    (set) => ({
      skillScope: 'user',
      setSkillScope: (skillScope) => set({ skillScope }),
      mcpScope: 'local',
      setMcpScope: (mcpScope) => set({ mcpScope }),
      selectedDxt: null,
      setSelectedDxt: (selectedDxt) => set({ selectedDxt }),
    }),
    { name: 'plugin-store' }
  )
);
