import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

const listWaiting = vi.fn();
const stop = vi.fn();
vi.mock('@/services/apiAdapt/acp', () => ({
  acpWaitingApprovals: (...args: unknown[]) => listWaiting(...args),
  acpStop: (...args: unknown[]) => stop(...args),
}));
vi.mock('@/services/apiAdapt/bots', () => ({ listBots: vi.fn().mockResolvedValue([]) }));
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
  useBotUiStore.setState({ statusByBot: {}, runningByBot: {}, connectionByBot: {}, sessionByBot: {} });
  listWaiting.mockResolvedValue([]);
  stop.mockReset().mockResolvedValue(undefined);
});

function emit(payload: Record<string, unknown>) {
  FakeEventSource.last?.onmessage?.({
    data: JSON.stringify({ event: 'bot:activity', payload }),
  } as MessageEvent);
}
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

it('drops the open connection when a background run continued its conversation', async () => {
  useBotUiStore.setState({ connectionByBot: { scout: 'c1' }, sessionByBot: { scout: 's1' } });
  useAcpStore.setState({ connectionId: 'c1', sessionId: 's1' });
  renderHook(() => useBotActivity());

  // A routine in a session of its own leaves the open conversation alone.
  emit({ botId: 'scout', sessionId: 's2', status: 'done' });
  // Waiting is mid-run: nothing is dropped yet.
  emit({ botId: 'scout', sessionId: 's1', status: 'waiting' });
  expect(stop).not.toHaveBeenCalled();

  emit({ botId: 'scout', sessionId: 's1', status: 'done' });
  await waitFor(() => expect(stop).toHaveBeenCalledWith('c1'));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(useBotUiStore.getState().connectionByBot).toEqual({});
  expect(useAcpStore.getState().connectionId).toBeNull();
});
