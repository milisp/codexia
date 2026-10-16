import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotInboxItem } from '@/services/apiAdapt/bots';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

const resolve = vi.fn();
const stop = vi.fn();
vi.mock('@/services/apiAdapt/bots', () => ({
  resolveBotInbox: (...args: unknown[]) => resolve(...args),
  listBotInbox: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/apiAdapt/acp', () => ({
  acpStop: (...args: unknown[]) => stop(...args),
}));
vi.mock('@/components/Markdown', () => ({
  Markdown: ({ value }: { value: string }) => <div>{value}</div>,
}));
vi.mock('@/features/plugins/hooks/useExternalUrl', () => ({
  useExternalUrl: () => ({ openExternalUrl: vi.fn() }),
}));
import { BotInboxCard } from './BotInboxCard';

function item(overrides: Partial<BotInboxItem>): BotInboxItem {
  return {
    id: 'd1',
    botId: 'scout',
    sessionId: 's1',
    kind: 'draft',
    title: 'Reply to Ana',
    body: 'Hi Ana',
    action: 'reply in the Gmail thread',
    status: 'open',
    createdAt: '',
    resolvedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolve.mockImplementation(async ({ id }: { id: string }) => item({ id, status: 'sent' }));
  stop.mockResolvedValue(undefined);
  useBotUiStore.setState({ connectionByBot: {}, sessionByBot: {}, runningByBot: {} });
});

describe('BotInboxCard', () => {
  it('sends the draft as edited and drops the live connection holding its conversation', async () => {
    useBotUiStore.setState({ connectionByBot: { scout: 'c1' }, sessionByBot: { scout: 's1' } });
    useAcpStore.setState({ connectionId: 'c1' });
    render(<BotInboxCard item={item({})} />);
    expect(screen.getByText('On Send: reply in the Gmail thread')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit draft' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Draft text' }), {
      target: { value: 'Hi Ana, thanks!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(resolve).toHaveBeenCalledWith({ id: 'd1', action: 'send', body: 'Hi Ana, thanks!' })
    );
    await waitFor(() => expect(stop).toHaveBeenCalledWith('c1'));
    expect(useBotUiStore.getState().connectionByBot).toEqual({});
    expect(useAcpStore.getState().connectionId).toBeNull();
  });

  it('offers only Copy and Discard for a draft with nothing to send', () => {
    render(<BotInboxCard item={item({ action: null })} />);
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(resolve).toHaveBeenCalledWith({ id: 'd1', action: 'discard', body: undefined });
  });

  it('finishes a hand-back with an optional note', async () => {
    render(
      <BotInboxCard
        item={item({
          id: 'h1',
          kind: 'handback',
          title: 'Sign in to the portal',
          body: '1. Open the portal\n2. Sign in',
          action: 'https://portal.example.com/login',
        })}
      />
    );
    expect(screen.getByText('Only you can do this step')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open link' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Note for the bot' }), {
      target: { value: 'Signed in as ops' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(resolve).toHaveBeenCalledWith({
        id: 'h1',
        action: 'done',
        body: undefined,
        note: 'Signed in as ops',
      })
    );
    // No live connection held the conversation, so none is stopped.
    expect(stop).not.toHaveBeenCalled();
  });

  it('does not continue a conversation that is still replying', async () => {
    useBotUiStore.setState({
      connectionByBot: { scout: 'c1' },
      sessionByBot: { scout: 's1' },
      runningByBot: { scout: true },
    });
    render(<BotInboxCard item={item({})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();
  });
});
