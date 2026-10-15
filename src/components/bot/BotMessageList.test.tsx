import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Bot } from '@/services/apiAdapt/bots';
import { useAcpStore } from '@/stores/useAcpStore';

const sections = vi.fn();
vi.mock('./useBotTimeline', () => ({
  useBotTimeline: () => ({ sections: sections(), error: '', retry: () => {} }),
}));
vi.mock('@/components/Markdown', () => ({
  Markdown: ({ value }: { value: string }) => <div data-testid="markdown">{value}</div>,
}));
import { BotMessageList } from './BotMessageList';

const bot = { id: 'scout', name: 'Scout', avatar: '🤖', color: 'blue' } as Bot;

beforeEach(() => {
  useAcpStore.getState().reset();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

it('shows a scheduled run as a marker, not as a message from you, and renders replies as Markdown', () => {
  sections.mockReturnValue([
    {
      sessionId: 's1',
      entries: [
        {
          id: 's1:u',
          role: 'user',
          text: 'Check the tea price',
          trigger: { kind: 'routine', name: 'Tea order' },
        },
        { id: 's1:a', role: 'agent', text: 'Tea is **$4.20**.' },
      ],
    },
  ]);
  render(<BotMessageList bot={bot} />);
  const marker = screen.getByText('Scheduled · Tea order');
  expect(marker.closest('details')).not.toBeNull();
  fireEvent.click(marker);
  expect(screen.getByText('Check the tea price')).toBeTruthy();
  expect(screen.getByTestId('markdown').textContent).toBe('Tea is **$4.20**.');
});

it('names the bot that asked for a delegated run', () => {
  sections.mockReturnValue([
    {
      sessionId: 's2',
      entries: [{ id: 's2:u', role: 'user', text: 'Ada asks: ...', trigger: { kind: 'bot', name: 'Ada' } }],
    },
  ]);
  render(<BotMessageList bot={bot} />);
  expect(screen.getByText('Asked by Ada')).toBeTruthy();
});
