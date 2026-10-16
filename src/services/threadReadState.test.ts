import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThreadReadStateStore } from '@/components/codex/stores/useThreadReadStateStore';

const updateThreadReadState = vi.fn();
const readThread = vi.fn();
const toastError = vi.fn();

vi.mock('@/services/apiAdapt', () => ({
  updateThreadReadState: (...args: unknown[]) => updateThreadReadState(...args),
  readThread: (...args: unknown[]) => readThread(...args),
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
    readThread.mockReset();
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

  it('adopts the server state on a revision conflict instead of the stale one', async () => {
    // Error text the 0.163 app-server returns for a stale expectedRevision.
    updateThreadReadState.mockRejectedValue(
      new Error('Request failed: {"code":-32600,"message":"read state changed"}')
    );
    const fresh = { firstUnread: { type: 'threadStart' as const }, revision: 'r3' };
    readThread.mockResolvedValue({ readState: fresh });

    await expect(setThreadReadState('t1', 'read')).resolves.toBe(false);

    expect(readThread).toHaveBeenCalledWith({ threadId: 't1', includeTurns: false });
    expect(useThreadReadStateStore.getState().states.t1).toEqual(fresh);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('never toasts for silent (automatic) updates', async () => {
    updateThreadReadState.mockRejectedValue(new Error('read state changed'));
    readThread.mockResolvedValue({ readState: unread });

    await setThreadReadState('t1', 'read', { silent: true });

    expect(toastError).not.toHaveBeenCalled();
  });

  it('does not call the server for a thread whose read state is unknown', async () => {
    await expect(setThreadReadState('missing', 'unread')).resolves.toBe(false);

    expect(updateThreadReadState).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledOnce();
  });
});
