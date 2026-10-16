import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAcpStore } from '@/stores/useAcpStore';

const apply = vi.fn();
vi.mock('./applyUpdate', () => ({ applyAcpUpdate: (...args: unknown[]) => apply(...args) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@/hooks/runtime', () => ({
  isDesktopTauri: () => false,
  buildEventUrl: (path: string) => path,
}));
import { useAcpEvents } from './useAcpEvents';

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor() {
    FakeEventSource.last = this;
  }
  close() {}
}

function emit(payload: Record<string, unknown>) {
  FakeEventSource.last?.onmessage?.({
    data: JSON.stringify({ event: 'acp-message', payload }),
  } as MessageEvent);
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource);
  apply.mockReset();
  useAcpStore.setState({ connectionId: 'c1', sessionId: 's1' });
});
afterEach(() => vi.unstubAllGlobals());

it('follows another process continuing the open session, but not its replay', () => {
  renderHook(() => useAcpEvents('c1'));
  const update = { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } };

  emit({ connectionId: 'c2', kind: 'update', sessionId: 's1', replay: true, update });
  emit({ connectionId: 'c2', kind: 'update', sessionId: 's2', update });
  emit({ connectionId: 'c2', kind: 'exited' });
  expect(apply).not.toHaveBeenCalled();

  emit({ connectionId: 'c2', kind: 'update', sessionId: 's1', replay: false, update });
  emit({ connectionId: 'c1', kind: 'update', sessionId: 's1', update });
  expect(apply).toHaveBeenCalledTimes(2);
});
