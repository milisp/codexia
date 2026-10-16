import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: { error: vi.fn() },
}));
vi.mock('@/services/apiAdapt/customModels', () => ({
  listCustomModels: vi.fn(),
  addCustomModel: vi.fn(),
  removeCustomModel: vi.fn(),
}));

import { toast } from '@/components/ui/use-toast';
import * as api from '@/services/apiAdapt/customModels';
import { missingModels, useModelSettingsStore } from './useModelSettingsStore';

const m = (id: string) => ({ id, name: id });

beforeEach(() => {
  vi.clearAllMocks();
  useModelSettingsStore.setState({ models: {}, legacyModels: {} });
});

describe('missingModels', () => {
  it('returns only legacy entries the backend lacks, without duplicates', () => {
    const result = missingModels({ p: [m('a'), m('b'), m('b')], q: [m('c')] }, { p: [m('a')] });
    expect(result).toEqual([
      ['p', m('b')],
      ['q', m('c')],
    ]);
  });
});

describe('load', () => {
  it('pushes legacy models once, then clears them', async () => {
    useModelSettingsStore.setState({ legacyModels: { p: [m('a'), m('b')] } });
    vi.mocked(api.listCustomModels)
      .mockResolvedValueOnce({ p: [m('a')] })
      .mockResolvedValueOnce({ p: [m('a'), m('b')] });
    vi.mocked(api.addCustomModel).mockResolvedValue({ p: [m('a'), m('b')] });

    await useModelSettingsStore.getState().load();

    expect(api.addCustomModel).toHaveBeenCalledTimes(1);
    expect(api.addCustomModel).toHaveBeenCalledWith('p', m('b'));
    expect(useModelSettingsStore.getState().models).toEqual({ p: [m('a'), m('b')] });
    expect(useModelSettingsStore.getState().legacyModels).toEqual({});
  });

  it('keeps legacy models when the push fails', async () => {
    useModelSettingsStore.setState({ legacyModels: { p: [m('b')] } });
    vi.mocked(api.listCustomModels).mockResolvedValue({});
    vi.mocked(api.addCustomModel).mockRejectedValue(new Error('offline'));

    await useModelSettingsStore.getState().load();

    expect(useModelSettingsStore.getState().legacyModels).toEqual({ p: [m('b')] });
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('addModel / removeModel', () => {
  it('updates local state from the backend response', async () => {
    vi.mocked(api.addCustomModel).mockResolvedValue({ p: [m('a')] });
    await useModelSettingsStore.getState().addModel('p', m('a'));
    expect(useModelSettingsStore.getState().getModels('p')).toEqual([m('a')]);

    vi.mocked(api.removeCustomModel).mockResolvedValue({});
    await useModelSettingsStore.getState().removeModel('p', 'a');
    expect(useModelSettingsStore.getState().getModels('p')).toEqual([]);
  });

  it('toasts and leaves state untouched on failure', async () => {
    useModelSettingsStore.setState({ models: { p: [m('a')] } });
    vi.mocked(api.removeCustomModel).mockRejectedValue(new Error('boom'));
    await useModelSettingsStore.getState().removeModel('p', 'a');
    expect(useModelSettingsStore.getState().models).toEqual({ p: [m('a')] });
    expect(toast.error).toHaveBeenCalledWith('Failed to remove model', { description: 'boom' });
  });
});
