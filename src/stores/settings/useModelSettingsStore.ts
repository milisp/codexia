import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from '@/components/ui/use-toast';
import {
  addCustomModel,
  type CustomModel,
  type CustomModelsByProvider,
  listCustomModels,
  removeCustomModel,
} from '@/services/apiAdapt/customModels';

// Provider is now an open string so new entries in llms.json need no store changes.
export type Provider = string;

export type { CustomModel };

interface ModelSettingsStore {
  // User-added model ids keyed by provider, mirrored from the Codexia backend so
  // every client shares one list. Which providers exist is read from config.toml.
  models: Record<string, CustomModel[]>;
  // Models found in this browser's pre-v3 localStorage, waiting to be pushed to
  // the backend once. Empty after a successful sync.
  legacyModels: Record<string, CustomModel[]>;

  load: () => Promise<void>;
  addModel: (provider: string, model: CustomModel) => Promise<void>;
  removeModel: (provider: string, id: string) => Promise<void>;

  // Convenience accessors for the old API surface (used in settings UI)
  getModels: (provider: string) => CustomModel[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Legacy entries the backend does not have yet (union by provider + id). */
export function missingModels(
  legacy: Record<string, CustomModel[]>,
  remote: Record<string, CustomModel[]>
): Array<[string, CustomModel]> {
  const missing: Array<[string, CustomModel]> = [];
  const seen = new Set<string>();
  for (const [provider, list] of Object.entries(legacy)) {
    for (const model of list ?? []) {
      const key = `${provider}\u0000${model.id}`;
      if (seen.has(key) || !provider.trim() || !model.id?.trim()) continue;
      seen.add(key);
      if (!(remote[provider] ?? []).some((m) => m.id === model.id)) {
        missing.push([provider, model]);
      }
    }
  }
  return missing;
}

let inflightLoad: Promise<void> | null = null;

export const useModelSettingsStore = create<ModelSettingsStore>()(
  persist(
    (set, get) => ({
      models: {},
      legacyModels: {},

      load: () => {
        // Several components call load on mount; share one request.
        inflightLoad ??= (async () => {
          try {
            let remote: CustomModelsByProvider = await listCustomModels();
            const legacy = get().legacyModels;
            // Push local-only entries, then clear them only once all succeed.
            const missing = missingModels(legacy, remote);
            if (missing.length > 0) {
              await Promise.all(
                missing.map(([provider, model]) => addCustomModel(provider, model))
              );
              remote = await listCustomModels();
            }
            set({ models: remote, legacyModels: {} });
          } catch (err) {
            toast.error('Failed to load custom models', { description: errorMessage(err) });
          } finally {
            inflightLoad = null;
          }
        })();
        return inflightLoad;
      },

      addModel: async (provider, model) => {
        try {
          set({ models: await addCustomModel(provider, model) });
        } catch (err) {
          toast.error('Failed to add model', { description: errorMessage(err) });
        }
      },

      removeModel: async (provider, id) => {
        try {
          set({ models: await removeCustomModel(provider, id) });
        } catch (err) {
          toast.error('Failed to remove model', { description: errorMessage(err) });
        }
      },

      getModels: (provider) => get().models[provider] ?? [],
    }),
    {
      name: 'model-settings',
      version: 3,
      // The model list now lives on the backend; only the not-yet-synced legacy
      // entries stay in localStorage.
      partialize: (state) => ({ legacyModels: state.legacyModels }),
      // v0/v1 also tracked `providers` and `hiddenProviders`; v2 kept `models`
      // locally. Carry any local models over as legacy entries to push once.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          models?: Record<string, CustomModel[]>;
          legacyModels?: Record<string, CustomModel[]>;
        };
        return { legacyModels: state.legacyModels ?? state.models ?? {} } as never;
      },
    }
  )
);
