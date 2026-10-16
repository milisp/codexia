import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const threadQueueList = vi.fn();
const threadQueueDelete = vi.fn();
const threadQueueReorder = vi.fn();
const threadQueueStart = vi.fn();
vi.mock('@/services/apiAdapt', () => ({
  threadQueueList: (...a: unknown[]) => threadQueueList(...a),
  threadQueueDelete: (...a: unknown[]) => threadQueueDelete(...a),
  threadQueueReorder: (...a: unknown[]) => threadQueueReorder(...a),
  threadQueueStart: (...a: unknown[]) => threadQueueStart(...a),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { useThreadQueueStore } from '@/components/codex/stores';
import { QueuedMessages } from './QueuedMessages';

const item = (id: string, text: string) => ({
  id,
  input: [{ type: 'text' as const, text, text_elements: [] }],
  clientUserMessageId: `c-${id}`,
});

describe('QueuedMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThreadQueueStore.setState({ queues: {} });
    threadQueueList.mockResolvedValue({
      data: [item('q1', 'first'), item('q2', 'second')],
      nextCursor: null,
    });
  });

  it('lists the queue of the current thread', async () => {
    render(<QueuedMessages threadId="t1" running />);
    expect(await screen.findByText('first')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();
    expect(threadQueueList).toHaveBeenCalledWith({ threadId: 't1', cursor: null });
    expect(screen.queryByRole('button', { name: /Send now/ })).toBeNull();
  });

  it('deletes and reorders through the server', async () => {
    threadQueueDelete.mockResolvedValue({ deleted: true });
    threadQueueReorder.mockResolvedValue({});
    render(<QueuedMessages threadId="t1" running />);
    await screen.findByText('first');

    fireEvent.click(screen.getByRole('button', { name: 'Move down: first' }));
    await waitFor(() =>
      expect(threadQueueReorder).toHaveBeenCalledWith({
        threadId: 't1',
        queuedSubmissionIds: ['q2', 'q1'],
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove: second' }));
    await waitFor(() =>
      expect(threadQueueDelete).toHaveBeenCalledWith({ threadId: 't1', queuedSubmissionId: 'q2' })
    );
  });

  it('offers send now only while the thread is idle', async () => {
    threadQueueStart.mockResolvedValue({ turn: { id: 'turn-9' } });
    render(<QueuedMessages threadId="t1" running={false} />);
    await screen.findByText('first');
    fireEvent.click(screen.getByRole('button', { name: 'Send now: first' }));
    await waitFor(() =>
      expect(threadQueueStart).toHaveBeenCalledWith({ threadId: 't1', queuedSubmissionId: 'q1' })
    );
  });
});
