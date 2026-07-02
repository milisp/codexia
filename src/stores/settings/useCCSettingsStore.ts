import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CCSettingsState {
  enabledThinking: boolean;
  toggleThinking: () => void;
  showPermissionCards: boolean;
  toggleShowPermissionCards: () => void;
}

export const useCCSettingsStore = create<CCSettingsState>()(
  persist(
    (set) => ({
      enabledThinking: false,
      toggleThinking: () => set((state) => ({ enabledThinking: !state.enabledThinking })),
      showPermissionCards: false,
      toggleShowPermissionCards: () =>
        set((state) => ({ showPermissionCards: !state.showPermissionCards })),
    }),
    {
      name: 'cc-settings',
    }
  )
);
