import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountUsageRead = vi.fn();
vi.mock('@/services', () => ({
  accountUsageRead: (...args: unknown[]) => accountUsageRead(...args),
}));
vi.mock('@/components/codex/stores/useCodexStore', () => ({
  useCodexStore: (selector: (s: unknown) => unknown) =>
    selector({
      currentThreadId: 'thread-1',
      tokenUsageMap: { 'thread-1': { total: { totalTokens: 10 } } },
    }),
}));

import { ThreadCostWidget } from './ThreadCostWidget';

beforeEach(() => vi.clearAllMocks());

describe('ThreadCostWidget', () => {
  it('shows the estimate and the per-model breakdown', async () => {
    accountUsageRead.mockResolvedValue({
      threadUsage: {
        threadId: 'thread-1',
        estimatedUsageCreditsMicros: 2_000_000,
        estimatedUsageUsdMicros: 80_000,
        groups: [
          {
            model: 'gpt-5',
            reasoningEffort: 'high',
            speed: null,
            estimatedUsageCreditsMicros: 2_000_000,
          },
        ],
      },
    });
    render(<ThreadCostWidget />);
    const button = await screen.findByRole('button', { name: 'Estimated thread cost $0.08' });
    expect(accountUsageRead).toHaveBeenCalledWith({ threadId: 'thread-1' });
    fireEvent.click(button);
    expect(await screen.findByText('gpt-5 (high)')).toBeTruthy();
    expect(screen.getByText(/Estimate for this thread only/)).toBeTruthy();
  });

  it('renders nothing when the server returns no usage', async () => {
    accountUsageRead.mockResolvedValue({ threadUsage: null });
    render(<ThreadCostWidget />);
    await waitFor(() => expect(accountUsageRead).toHaveBeenCalled());
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing when the request fails', async () => {
    accountUsageRead.mockRejectedValue(new Error('nope'));
    render(<ThreadCostWidget />);
    await waitFor(() => expect(accountUsageRead).toHaveBeenCalled());
    expect(screen.queryByRole('button')).toBeNull();
  });
});
