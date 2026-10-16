import { beforeEach, describe, expect, it, vi } from 'vitest';

const turnSettingsUpdate = vi.fn();
vi.mock('@/services/codexService', () => ({
  codexService: { turnSettingsUpdate: (...args: unknown[]) => turnSettingsUpdate(...args) },
}));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

import { useCodexStore } from '@/components/codex/stores';
import { applyToRunningTurn } from './runningTurnSettings';

const setThread = (status: 'idle' | 'active', turnId: string | null) =>
  useCodexStore.setState({
    currentThreadId: 't1',
    currentTurnId: turnId,
    threadStatusMap: {
      t1: status === 'active' ? { type: 'active', activeFlags: [] } : { type: 'idle' },
    },
    turnTimingMap: {},
  });

describe('applyToRunningTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing while the thread is idle', async () => {
    setThread('idle', 'turn-1');
    applyToRunningTurn({ model: 'gpt-x' });
    await Promise.resolve();
    expect(turnSettingsUpdate).not.toHaveBeenCalled();
  });

  it('updates the running turn once for a model and effort change made together', async () => {
    setThread('active', 'turn-1');
    turnSettingsUpdate.mockResolvedValue('applied');
    applyToRunningTurn({ model: 'gpt-x' });
    applyToRunningTurn({ effort: 'high' });
    await vi.waitFor(() => expect(turnSettingsUpdate).toHaveBeenCalledTimes(1));
    expect(turnSettingsUpdate).toHaveBeenCalledWith('t1', 'turn-1', {
      model: 'gpt-x',
      effort: 'high',
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('prefers the turn tracked from turn/started over a stale currentTurnId', async () => {
    setThread('active', 'old-turn');
    useCodexStore.setState({
      turnTimingMap: {
        t1: { turnId: 'queued-turn', startedAtMs: 1, durationMs: null, status: 'inProgress' },
      },
    });
    turnSettingsUpdate.mockResolvedValue('applied');
    applyToRunningTurn({ effort: 'low' });
    await vi.waitFor(() => expect(turnSettingsUpdate).toHaveBeenCalled());
    expect(turnSettingsUpdate).toHaveBeenCalledWith('t1', 'queued-turn', { effort: 'low' });
  });

  it('reports a rejected change instead of claiming it applied', async () => {
    setThread('active', 'turn-1');
    turnSettingsUpdate.mockResolvedValue('targetUnavailable');
    applyToRunningTurn({ model: 'gpt-x' });
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));

    turnSettingsUpdate.mockRejectedValue(new Error('unsupported model'));
    applyToRunningTurn({ model: 'bad' });
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
    expect(toastError.mock.calls[1][0]).toContain('unsupported model');
  });
});
