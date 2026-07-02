import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Model } from '@/bindings/v2';
import { listModels, listOtherModels } from '@/services/tauri';
import { useModelSettingsStore } from '@/stores/settings';
import type { FrontendProviderModels, ModelListItem } from '../composer/ModelList';

export function useModels() {
  const [openAiModels, setOpenAiModels] = useState<Model[]>([]);
  const [otherModels, setOtherModels] = useState<Record<string, ModelListItem[]>>({});
  const { models: storedModels } = useModelSettingsStore();

  useEffect(() => {
    void listModels()
      .then((res) => setOpenAiModels(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    listOtherModels()
      .then((items: FrontendProviderModels[]) => {
        const grouped: Record<string, ModelListItem[]> = {};
        for (const item of items) {
          grouped[item.provider] = item.models.map((m) => ({
            id: m.id,
            label: m.id,
          }));
        }
        setOtherModels(grouped);
      })
      .catch(() => {});
  }, []);

  const allProviders = useMemo(() => {
    const providers = new Set<string>(['openai']);
    Object.keys(otherModels).forEach((p) => providers.add(p));
    Object.keys(storedModels).forEach((p) => providers.add(p));
    return Array.from(providers);
  }, [otherModels, storedModels]);

  const providerItems = useCallback(
    (provider: string): ModelListItem[] => {
      if (provider === 'openai') {
        return openAiModels.map((m) => ({
          id: m.id,
          label: m.displayName || m.model,
          description: m.description,
        }));
      }
      const stored = (storedModels[provider] ?? []).map((m) => ({ id: m.id, label: m.name }));
      const others = otherModels[provider] ?? [];
      return [...stored, ...others];
    },
    [openAiModels, otherModels, storedModels]
  );

  return {
    openAiModels,
    providerItems,
    allProviders,
  };
}
