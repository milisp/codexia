import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublishGameResult } from '@/services';

export type PublishSettings = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  buildCommand: string;
  outputDir: string;
  coverPath: string;
};

export type LastPublish = PublishGameResult & { publishedAt: string };

interface PublishStore {
  /** Per-project form values, keyed by project path. */
  settings: Record<string, Partial<PublishSettings>>;
  lastPublish: Record<string, LastPublish>;
  updateSettings: (cwd: string, patch: Partial<PublishSettings>) => void;
  setLastPublish: (cwd: string, result: LastPublish) => void;
}

export const usePublishStore = create<PublishStore>()(
  persist(
    (set) => ({
      settings: {},
      lastPublish: {},
      updateSettings: (cwd, patch) =>
        set((state) => ({
          settings: { ...state.settings, [cwd]: { ...state.settings[cwd], ...patch } },
        })),
      setLastPublish: (cwd, result) =>
        set((state) => ({ lastPublish: { ...state.lastPublish, [cwd]: result } })),
    }),
    { name: 'publish-storage', version: 1 }
  )
);
