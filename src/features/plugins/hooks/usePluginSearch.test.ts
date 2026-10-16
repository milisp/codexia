import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginSearchResult } from '@/bindings/v2';

const pluginSearch = vi.fn();
vi.mock('@/services', () => ({ pluginSearch: (...args: unknown[]) => pluginSearch(...args) }));

import { PLUGIN_SEARCH_DEBOUNCE_MS, usePluginSearch } from './usePluginSearch';

function result(name: string): PluginSearchResult {
  return { plugin: { id: name, name } as never, marketplaceName: 'm', marketplacePath: null };
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(PLUGIN_SEARCH_DEBOUNCE_MS + 1);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  pluginSearch.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('usePluginSearch', () => {
  it('debounces keystrokes into a single request', async () => {
    pluginSearch.mockResolvedValue({ data: [result('git')], nextCursor: null });
    const { result: hook, rerender } = renderHook(({ q }) => usePluginSearch(q), {
      initialProps: { q: 'g' },
    });
    rerender({ q: 'gi' });
    rerender({ q: 'git' });
    expect(pluginSearch).not.toHaveBeenCalled();
    await flush();
    expect(pluginSearch).toHaveBeenCalledTimes(1);
    expect(pluginSearch).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: 'git' }));
    expect(hook.current?.map((r) => r.plugin.name)).toEqual(['git']);
  });

  it('ignores stale responses and hides results for a changed query', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    pluginSearch
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ data: [result('second')], nextCursor: null });
    const { result: hook, rerender } = renderHook(({ q }) => usePluginSearch(q), {
      initialProps: { q: 'first' },
    });
    await flush();
    rerender({ q: 'second' });
    expect(hook.current).toBeNull();
    await flush();
    await act(async () => resolveFirst({ data: [result('first')], nextCursor: null }));
    expect(hook.current?.map((r) => r.plugin.name)).toEqual(['second']);
  });

  it('returns null on error so callers fall back to the local filter', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    pluginSearch.mockRejectedValue(new Error('boom'));
    const { result: hook } = renderHook(() => usePluginSearch('git'));
    await flush();
    expect(hook.current).toBeNull();
  });

  it('does not call the server for an empty query', async () => {
    const { result: hook } = renderHook(() => usePluginSearch('   '));
    await flush();
    expect(pluginSearch).not.toHaveBeenCalled();
    expect(hook.current).toBeNull();
  });
});
