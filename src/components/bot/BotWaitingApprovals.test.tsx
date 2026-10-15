import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AcpWaitingApproval } from '@/services/apiAdapt/acp';
import type { Bot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';

const listWaiting = vi.fn();
const respond = vi.fn();
const update = vi.fn();
vi.mock('@/services/apiAdapt/acp', () => ({
  acpWaitingApprovals: (...args: unknown[]) => listWaiting(...args),
  acpRespondPermission: (...args: unknown[]) => respond(...args),
}));
vi.mock('@/services/apiAdapt/bots', () => ({
  parseBotList: (value: string) => JSON.parse(value) as string[],
  updateBot: (...args: unknown[]) => update(...args),
}));
import { BotWaitingApprovals } from './BotWaitingApprovals';

const bot = { id: 'scout', name: 'Scout', approvedTools: '[]' } as Bot;
const options = [
  { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
  { optionId: 'deny', name: 'Deny', kind: 'reject_once' },
];
function waiting(overrides: Partial<AcpWaitingApproval>): AcpWaitingApproval {
  return {
    connectionId: 'c1',
    requestId: 'c1-900',
    botId: 'scout',
    toolCall: { title: 'execute: npm publish', kind: 'execute' },
    options,
    personRequired: false,
    requestedAt: '2026-10-14T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  respond.mockResolvedValue(undefined);
  update.mockResolvedValue({ ...bot, approvedTools: '["execute"]' });
  useBotUiStore.setState({ statusByBot: { scout: 'waiting' } });
});

it('answers a waiting step and can remember an ordinary tool', async () => {
  listWaiting.mockResolvedValueOnce([waiting({})]).mockResolvedValue([]);
  render(<BotWaitingApprovals bot={bot} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Always allow execute' }));
  await waitFor(() => expect(respond).toHaveBeenCalledWith('c1', 'c1-900', 'allow'));
  await waitFor(() => expect(update).toHaveBeenCalledWith('scout', { approvedTools: ['execute'] }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Deny' })).toBeNull());
});

it('offers no standing approval for a step only a person may approve', async () => {
  listWaiting.mockResolvedValue([
    waiting({ personRequired: true, toolCall: { title: 'acp:stripe:create_payment', kind: 'execute' } }),
  ]);
  render(<BotWaitingApprovals bot={bot} />);
  expect(await screen.findByText('Needs your approval every time.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Always allow/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
  await waitFor(() => expect(respond).toHaveBeenCalledWith('c1', 'c1-900', 'deny'));
  expect(update).not.toHaveBeenCalled();
});

it('remembers an MCP tool by its id, never by the kind every MCP tool shares', async () => {
  listWaiting.mockResolvedValueOnce([
    waiting({
      approvalKey: 'acp:shop:lookup_price',
      toolCall: { title: 'acp:shop:lookup_price: calls the `shop` MCP server', kind: 'other' },
    }),
  ]).mockResolvedValue([]);
  render(<BotWaitingApprovals bot={bot} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Always allow lookup_price' }));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith('scout', { approvedTools: ['acp:shop:lookup_price'] })
  );
});

it('renders nothing when no step is waiting', async () => {
  listWaiting.mockResolvedValue([]);
  const { container } = render(<BotWaitingApprovals bot={bot} />);
  await waitFor(() => expect(listWaiting).toHaveBeenCalledWith('scout'));
  expect(container.firstChild).toBeNull();
});
