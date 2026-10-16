import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerNotification } from '@/bindings';

const threadQueueList = vi.fn();
vi.mock('@/services/apiAdapt', () => ({
  threadQueueList: (...args: unknown[]) => threadQueueList(...args),
  allowSleep: vi.fn().mockResolvedValue(undefined),
  preventSleep: vi.fn().mockResolvedValue(undefined),
}));

import { useCodexStore, useThreadQueueStore } from '@/components/codex/stores';
import { useServerNotificationHandler } from './useServerNotificationHandler';

const refs = {
  isCodexThreadActiveRef: { current: false },
  taskCompleteBeepModeRef: { current: 'never' as const },
  preventSleepDuringTasksRef: { current: false },
};

const queued = (id: string) => ({ id, input: [], clientUserMessageId: `c-${id}` });

describe('thread/queue/changed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCodexStore.setState({ events: {} });
    useThreadQueueStore.setState({ queues: {} });
  });

  it('refetches the queue of that thread and keeps it out of the transcript', async () => {
    threadQueueList.mockResolvedValueOnce({ data: [queued('q1'), queued('q2')], nextCursor: null });
    const { result } = renderHook(() => useServerNotificationHandler(refs, vi.fn()));

    result.current({
      method: 'thread/queue/changed',
      params: { threadId: 't1' },
    } as ServerNotification);

    await vi.waitFor(() =>
      expect(useThreadQueueStore.getState().queues.t1?.map((i) => i.id)).toEqual(['q1', 'q2'])
    );
    expect(threadQueueList).toHaveBeenCalledWith({ threadId: 't1', cursor: null });
    expect(useCodexStore.getState().events.t1 ?? []).toHaveLength(0);
  });

  it('follows pagination cursors', async () => {
    threadQueueList
      .mockResolvedValueOnce({ data: [queued('q1')], nextCursor: '1' })
      .mockResolvedValueOnce({ data: [queued('q2')], nextCursor: null });
    await useThreadQueueStore.getState().refresh('t1');
    expect(useThreadQueueStore.getState().queues.t1?.map((i) => i.id)).toEqual(['q1', 'q2']);
    expect(threadQueueList).toHaveBeenLastCalledWith({ threadId: 't1', cursor: '1' });
  });
});
