import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import type { Model } from '@/bindings/v2';
import type { FrontendProviderModels, ModelListItem } from '@/components/codex/types';
import { listModels, listOtherModels } from '@/services/apiAdapt';
import { useModelSettingsStore } from '@/stores/settings';

type ModelCacheStore = {
  openAiModels: Model[];
  otherModels: Record<string, ModelListItem[]>;
  loaded: boolean;
  load: () => void;
};

// Shared across every selector instance so the model lists are fetched once.
const useModelCacheStore = create<ModelCacheStore>()((set, get) => ({
  openAiModels: [],
  otherModels: {},
  loaded: false,

  load: () => {
    if (get().loaded) return;
    set({ loaded: true });

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
  const storedModels = useModelSettingsStore((s) => s.models);
  const hiddenProviders = useModelSettingsStore((s) => s.hiddenProviders);

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

    for (const provider of new Set([...Object.keys(otherModels), ...Object.keys(storedModels)])) {
      if (provider === 'openai') continue;
      const stored = (storedModels[provider] ?? []).map((m) => ({ id: m.id, label: m.name }));
      map[provider] = [...stored, ...(otherModels[provider] ?? [])];
    }

    return map;
  }, [openAiModels, otherModels, storedModels]);

  // Hidden providers stay in itemsByProvider so an already-selected model keeps its label.
  const allProviders = useMemo(
    () => Object.keys(itemsByProvider).filter((p) => !hiddenProviders.includes(p)),
    [itemsByProvider, hiddenProviders]
  );

  const providerItems = useMemo(
    () =>
      (provider: string): ModelListItem[] =>
        itemsByProvider[provider] ?? [],
    [itemsByProvider]
  );

  return {
    openAiModels,
    itemsByProvider,
    providerItems,
    allProviders,
  };
}
