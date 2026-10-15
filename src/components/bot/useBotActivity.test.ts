import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBotUiStore } from '@/stores/useBotUiStore';

const listWaiting = vi.fn();
vi.mock('@/services/apiAdapt/acp', () => ({
  acpWaitingApprovals: (...args: unknown[]) => listWaiting(...args),
}));
vi.mock('@/services/apiAdapt/bots', () => ({ listBots: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@/hooks/runtime', () => ({
  isDesktopTauri: () => false,
  buildEventUrl: (path: string) => path,
}));
import { useBotActivity } from './useBotActivity';

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor() {
    FakeEventSource.last = this;
  }
  close() {}
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource);
  useBotUiStore.setState({ statusByBot: {}, runningByBot: {} });
});
afterEach(() => vi.unstubAllGlobals());

it('shows a run already waiting for approval when the stream (re)connects', async () => {
  listWaiting.mockResolvedValue([
    { botId: 'scout', connectionId: 'c1', requestId: 'c1-1', options: [], personRequired: true },
    { botId: null, connectionId: 'c2', requestId: 'c2-1', options: [], personRequired: false },
  ]);
  renderHook(() => useBotActivity());
  FakeEventSource.last?.onopen?.();

  await waitFor(() => expect(useBotUiStore.getState().statusByBot).toEqual({ scout: 'waiting' }));
  expect(useBotUiStore.getState().runningByBot).toEqual({ scout: true });
  expect(listWaiting).toHaveBeenCalledWith();
});
