import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThreadReadStateStore } from '@/components/codex/stores/useThreadReadStateStore';

const updateThreadReadState = vi.fn();
const toastError = vi.fn();

vi.mock('@/services/apiAdapt', () => ({
  updateThreadReadState: (...args: unknown[]) => updateThreadReadState(...args),
}));
vi.mock('@/components/ui/use-toast', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { setThreadReadState } from './threadReadState';

const unread = { firstUnread: { type: 'threadStart' as const }, revision: 'r1' };
const read = { firstUnread: null, revision: 'r2' };

describe('setThreadReadState', () => {
  beforeEach(() => {
    updateThreadReadState.mockReset();
    toastError.mockReset();
    useThreadReadStateStore.setState({ states: { t1: unread } });
  });

  it('sends the known revision and stores the server answer', async () => {
    updateThreadReadState.mockResolvedValue({ readState: read });

    await expect(setThreadReadState('t1', 'read')).resolves.toBe(true);

    expect(updateThreadReadState).toHaveBeenCalledWith({
      threadId: 't1',
      operation: { type: 'read' },
      expectedRevision: 'r1',
    });
    expect(useThreadReadStateStore.getState().states.t1).toEqual(read);
  });

  it('reverts the local state and toasts when the server rejects the update', async () => {
    updateThreadReadState.mockRejectedValue(new Error('revision conflict'));

    await expect(setThreadReadState('t1', 'read')).resolves.toBe(false);

    expect(useThreadReadStateStore.getState().states.t1).toEqual(unread);
    expect(toastError).toHaveBeenCalledOnce();
  });

  it('does not call the server for a thread whose read state is unknown', async () => {
    await expect(setThreadReadState('missing', 'unread')).resolves.toBe(false);

    expect(updateThreadReadState).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledOnce();
  });
});
