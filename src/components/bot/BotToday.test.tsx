import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationTask } from '@/services/apiAdapt/automation';
import type { Bot, BotRun } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';

const listRuns = vi.fn();
const listTasks = vi.fn();
const update = vi.fn();
const listInbox = vi.fn();
vi.mock('@/services/apiAdapt/bots', () => ({
  listBotRuns: (...args: unknown[]) => listRuns(...args),
  listBotInbox: (...args: unknown[]) => listInbox(...args),
  resolveBotInbox: vi.fn(),
  updateBot: (...args: unknown[]) => update(...args),
  parseBotList: () => [],
}));
vi.mock('@/services/apiAdapt/automation', () => ({
  listAutomations: (...args: unknown[]) => listTasks(...args),
}));
vi.mock('@/services/apiAdapt/acp', () => ({
  acpWaitingApprovals: vi.fn().mockResolvedValue([
    {
      connectionId: 'c1',
      requestId: 'c1-1',
      botId: 'shop',
      toolCall: { title: 'create_payment', kind: 'other' },
      options: [{ optionId: 'allow', name: 'Allow once', kind: 'allow_once' }],
      personRequired: true,
    },
  ]),
  acpRespondPermission: vi.fn(),
}));
import { BotToday } from './BotToday';

const scout = {
  id: 'scout',
  name: 'Scout',
  title: 'Research',
  avatar: '🧭',
  color: '#2563eb',
  lastViewedAt: '2026-10-15T08:00:00Z',
} as Bot;
const shop = { id: 'shop', name: 'Shop', avatar: '🛒', color: '#16a34a', lastViewedAt: null } as Bot;

function run(overrides: Partial<BotRun>): BotRun {
  return {
    runId: 'r',
    botId: 'scout',
    sessionId: 's',
    triggerKind: 'routine',
    triggerName: 'Daily brief',
    status: 'done',
    summary: 'Three new papers on retrieval.',
    startedAt: '2026-10-15T08:59:00Z',
    finishedAt: '2026-10-15T09:00:00Z',
    ...overrides,
  };
}

function task(overrides: Partial<AutomationTask>): AutomationTask {
  return {
    id: 't',
    name: 'Daily brief',
    projects: [],
    prompt: 'Brief me',
    agent: 'bot',
    bot_id: 'scout',
    model_provider: 'openai',
    model: '',
    schedule: { mode: 'daily', hour: 9, minute: 0, interval_hours: null, weekdays: [] },
    cron_expression: '',
    created_at: '',
    paused: false,
    cwd_mode: 'cwd',
    ...overrides,
  } as AutomationTask;
}

beforeEach(() => {
  vi.clearAllMocks();
  listInbox.mockResolvedValue([]);
  useBotUiStore.setState({ bots: [scout, shop], statusByBot: {} });
});

describe('BotToday', () => {
  it('lists runs finished since each bot was opened and the next scheduled runs', async () => {
    listRuns.mockResolvedValue([
      run({ runId: 'new' }),
      run({ runId: 'seen', summary: 'Old news', finishedAt: '2026-10-15T07:00:00Z' }),
      run({ runId: 'live', status: 'working', finishedAt: null, summary: null }),
      run({
        runId: 'asked',
        botId: 'shop',
        triggerKind: 'bot',
        triggerName: 'Scout',
        status: 'blocked',
        summary: 'Payment was denied.',
      }),
    ]);
    listTasks.mockResolvedValue([
      task({ id: 'late', name: 'Weekly review', next_run_at: '2030-01-08T09:00:00Z' }),
      task({ id: 'soon', name: 'Daily brief', next_run_at: '2030-01-02T09:00:00Z' }),
      task({ id: 'paused', name: 'Paused one', paused: true, next_run_at: null }),
      task({ id: 'codex', name: 'Not a bot', agent: 'codex', bot_id: null }),
    ]);
    const select = vi.fn();
    render(<BotToday creating={false} onCreate={vi.fn()} onSelect={select} />);

    const done = await screen.findByRole('region', { name: 'Done since you looked' });
    expect(within(done).getByText('Three new papers on retrieval.')).toBeTruthy();
    expect(within(done).getByText('Asked by Scout')).toBeTruthy();
    expect(within(done).getByText('Blocked')).toBeTruthy();
    expect(within(done).queryByText('Old news')).toBeNull();

    const upcoming = screen.getByRole('region', { name: 'Coming up' });
    const names = within(upcoming)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names[0]).toContain('Daily brief');
    expect(names[1]).toContain('Weekly review');
    expect(names).toHaveLength(2);

    fireEvent.click(within(done).getByText('Payment was denied.'));
    expect(select).toHaveBeenCalledWith(shop);
  });

  it('marks every finished run seen in one step', async () => {
    listRuns.mockResolvedValue([run({ runId: 'new' })]);
    listTasks.mockResolvedValue([]);
    update.mockImplementation(async (id: string, patch: Partial<Bot>) => ({ ...scout, id, ...patch }));
    render(<BotToday creating={false} onCreate={vi.fn()} onSelect={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark all seen' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('scout', expect.objectContaining({ unreadCount: 0 }))
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Done since you looked' })).toBeNull());
  });

  it('puts bots waiting on a person first, and says so when nothing needs you', async () => {
    listRuns.mockResolvedValue([]);
    listTasks.mockResolvedValue([]);
    const { unmount } = render(<BotToday creating={false} onCreate={vi.fn()} onSelect={vi.fn()} />);
    expect(await screen.findByText('Nothing needs you right now.')).toBeTruthy();
    unmount();

    useBotUiStore.setState({ statusByBot: { shop: 'waiting' } });
    const select = vi.fn();
    render(<BotToday creating={false} onCreate={vi.fn()} onSelect={select} />);
    const needs = screen.getByRole('region', { name: 'Needs you' });
    expect(await within(needs).findByText('create_payment')).toBeTruthy();
    expect(within(needs).getByRole('button', { name: 'Allow once' })).toBeTruthy();
    expect(screen.queryByText('Nothing needs you right now.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open Scout' }));
    expect(select).toHaveBeenCalledWith(scout);
  });

  it('lists drafts and hand-backs from every bot under Needs you', async () => {
    listRuns.mockResolvedValue([]);
    listTasks.mockResolvedValue([]);
    listInbox.mockResolvedValue([
      {
        id: 'd1',
        botId: 'scout',
        sessionId: 's1',
        kind: 'draft',
        title: 'Reply to Ana',
        body: 'Hi Ana',
        action: 'reply in Gmail',
        status: 'open',
        createdAt: '',
        resolvedAt: null,
      },
    ]);
    render(<BotToday creating={false} onCreate={vi.fn()} onSelect={vi.fn()} />);
    const needs = await screen.findByRole('region', { name: 'Needs you' });
    expect(within(needs).getByText('Reply to Ana')).toBeTruthy();
    expect(within(needs).getByRole('button', { name: 'Send' })).toBeTruthy();
    expect(listInbox).toHaveBeenCalledWith(undefined);
  });
});
