import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Bot } from '@/services/apiAdapt/bots';
import { BotWelcome } from './BotWelcome';

describe('BotWelcome', () => {
  it('offers a direct first-bot action and disables it while creating', () => {
    const create = vi.fn();
    const { rerender } = render(<BotWelcome bots={[]} creating={false} onCreate={create} onSelect={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Create your first bot' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create bot' }));
    expect(create).toHaveBeenCalledOnce();
    rerender(<BotWelcome bots={[]} creating onCreate={create} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Creating…' }).hasAttribute('disabled')).toBe(true);
  });

  it('opens an existing bot from its card and keeps new-bot creation available', () => {
    const bot = { id: 'scout', name: 'Scout', title: 'Research', avatar: '🧭', color: '#2563eb' } as Bot;
    const select = vi.fn();
    render(<BotWelcome bots={[bot]} creating={false} onCreate={vi.fn()} onSelect={select} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Scout' }));
    expect(select).toHaveBeenCalledWith(bot);
    expect(screen.getByRole('button', { name: 'New bot' })).toBeTruthy();
  });
});
