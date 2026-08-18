import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import type { Model } from '@/bindings/v2';
import type {
  ConfigProvider,
  FrontendProviderModels,
  ModelListItem,
  ProviderPreset,
} from '@/components/codex/types';
import {
  listConfigProviders,
  listModels,
  listOtherModels,
  listProviderPresets,
} from '@/services/apiAdapt';
import { useModelSettingsStore } from '@/stores/settings';

type ModelCacheStore = {
  openAiModels: Model[];
  otherModels: Record<string, ModelListItem[]>;
  // Providers read from the user's config.toml — the source of truth for which
  // providers exist at all.
  configProviders: ConfigProvider[];
  // llms.json entries: suggested models a user can add, never auto-listed.
  presets: ProviderPreset[];
  loaded: boolean;
  load: () => void;
  refreshProviders: () => Promise<void>;
};

// Shared across every selector instance so the model lists are fetched once.
const useModelCacheStore = create<ModelCacheStore>()((set, get) => ({
  openAiModels: [],
  otherModels: {},
  configProviders: [],
  presets: [],
  loaded: false,

  refreshProviders: async () => {
    try {
      set({ configProviders: await listConfigProviders() });
    } catch {
      // Codex backend unavailable: keep whatever was loaded before.
    }
  },

  load: () => {
    if (get().loaded) return;
    set({ loaded: true });

    void get().refreshProviders();

    void listProviderPresets()
      .then((presets) => set({ presets }))
      .catch(() => {});

    void listModels()
      .then((res) => set({ openAiModels: res.data }))
      .catch(() => {});

    void listOtherModels()
      .then((items: FrontendProviderModels[]) => {
        const grouped: Record<string, ModelListItem[]> = {};
        for (const item of items) {
          grouped[item.provider] = item.models.map((m) => ({ id: m.id, label: m.id }));
        }
        set({ otherModels: grouped });
      })
      .catch(() => {});
  },
}));

export function useModels() {
  const openAiModels = useModelCacheStore((s) => s.openAiModels);
  const otherModels = useModelCacheStore((s) => s.otherModels);
  const load = useModelCacheStore((s) => s.load);
  const configProviders = useModelCacheStore((s) => s.configProviders);
  const refreshProviders = useModelCacheStore((s) => s.refreshProviders);
  const presets = useModelCacheStore((s) => s.presets);
  const storedModels = useModelSettingsStore((s) => s.models);

  useEffect(() => {
    load();
  }, [load]);

  // Precomputed once per data change instead of per render/filter pass.
  const itemsByProvider = useMemo(() => {
    const map: Record<string, ModelListItem[]> = {
      openai: openAiModels.map((m) => ({
        id: m.id,
        label: m.displayName || m.model,
        description: m.description,
      })),
    };

    // Only providers present in config.toml; llms.json entries are merely
    // suggested models for those.
    for (const { name: provider } of configProviders) {
      if (provider === 'openai') continue;
      const stored = (storedModels[provider] ?? []).map((m) => ({ id: m.id, label: m.name }));
      const suggested = (otherModels[provider] ?? []).filter(
        (m) => !stored.some((s) => s.id === m.id)
      );
      map[provider] = [...stored, ...suggested];
    }

    return map;
  }, [openAiModels, otherModels, storedModels, configProviders]);

  const allProviders = useMemo(() => Object.keys(itemsByProvider), [itemsByProvider]);

  const providerItems = useMemo(
    () =>
      (provider: string): ModelListItem[] =>
        itemsByProvider[provider] ?? [],
    [itemsByProvider]
  );

  // Models llms.json knows about that the user has not added yet.
  const providerSuggestions = useMemo(
    () =>
      (provider: string): ModelListItem[] => {
        const listed = itemsByProvider[provider] ?? [];
        const preset = presets.find((p) => p.model_provider === provider);
        return (preset?.models ?? [])
          .filter((m) => !listed.some((item) => item.id === m.id))
          .map((m) => ({ id: m.id, label: m.id }));
      },
    [presets, itemsByProvider]
  );

  return {
    openAiModels,
    providerSuggestions,
    itemsByProvider,
    providerItems,
    allProviders,
    configProviders,
    refreshProviders,
  };
}
