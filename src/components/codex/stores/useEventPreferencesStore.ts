import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EventPreferencesStore {
  hasConfirmedEditRollback: boolean;
  setHasConfirmedEditRollback: (value: boolean) => void;
}

export const useEventPreferencesStore = create<EventPreferencesStore>()(
  persist(
    (set) => ({
      hasConfirmedEditRollback: false,
      setHasConfirmedEditRollback: (value) => set({ hasConfirmedEditRollback: value }),
    }),
    {
      name: 'event-preferences-store',
      version: 1,
    }
  )
);
