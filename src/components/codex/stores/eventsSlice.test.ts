import { beforeEach, describe, expect, it } from 'vitest';
import type { ServerNotification } from '@/bindings';
import { useCodexStore } from './useCodexStore';

const THREAD = 'thread-1';

const notify = (event: unknown) =>
  useCodexStore.getState().addEvent(THREAD, event as ServerNotification);

describe('addEvent transcript filtering', () => {
  beforeEach(() => {
    useCodexStore.setState({ events: {}, threadStatusMap: {} });
  });

  it('keeps notifications that have no transcript renderer out of the thread events', () => {
    notify({
      method: 'item/reasoning/summaryTextDelta',
      params: { threadId: THREAD, turnId: 't1', itemId: 'r1', delta: 'thinking', summaryIndex: 0 },
    });
    notify({ method: 'thread/queue/changed', params: { threadId: THREAD } });

    expect(useCodexStore.getState().events[THREAD] ?? []).toHaveLength(0);
  });

  it('still records transcript events and derived state', () => {
    notify({ method: 'warning', params: { threadId: THREAD, message: 'careful' } });
    notify({ method: 'thread/status/changed', params: { threadId: THREAD, status: { type: 'idle' } } });

    const state = useCodexStore.getState();
    expect(state.events[THREAD]?.map((e) => e.method)).toEqual(['warning', 'thread/status/changed']);
    expect(state.threadStatusMap[THREAD]).toEqual({ type: 'idle' });
  });
});

describe("thread/readState/changed", () => {
  it("never reaches the transcript", () => {
    useCodexStore.setState({ events: {}, threadStatusMap: {} });
    notify({
      method: "thread/readState/changed",
      params: { threadId: THREAD, readState: { firstUnread: null, revision: "r1" } },
    });

    expect(useCodexStore.getState().events[THREAD] ?? []).toHaveLength(0);
  });
});
