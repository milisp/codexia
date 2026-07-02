import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Provider is now an open string so new entries in llms.json need no store changes.
export type Provider = string;

export interface CustomModel {
  id: string;
  name: string;
}

interface ModelSettingsStore {
  // User-added models keyed by provider (e.g. { ollama: ['llama3'], custom: ['my-model'] })
  models: Record<string, CustomModel[]>;

  addModel: (provider: string, model: CustomModel) => void;
  removeModel: (provider: string, id: string) => void;

  // Convenience accessors for the old API surface (used in settings UI)
  getModels: (provider: string) => CustomModel[];
}

export const useModelSettingsStore = create<ModelSettingsStore>()(
  persist(
    (set, get) => ({
      models: {},

      addModel: (provider, model) =>
        set((state) => {
          const existing = state.models[provider] ?? [];
          if (existing.some((m) => m.id === model.id)) return state;
          return { models: { ...state.models, [provider]: [...existing, model] } };
        }),

      removeModel: (provider, id) =>
        set((state) => ({
          models: {
            ...state.models,
            [provider]: (state.models[provider] ?? []).filter((m) => m.id !== id),
          },
        })),

      getModels: (provider) => get().models[provider] ?? [],
    }),
    {
      name: 'model-settings',
    }
  )
);
