import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BotWelcome } from './BotWelcome';

describe('BotWelcome', () => {
  it('offers a direct first-bot action and disables it while creating', () => {
    const create = vi.fn();
    const { rerender } = render(<BotWelcome creating={false} onCreate={create} />);
    expect(screen.getByRole('heading', { name: 'Create your first bot' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create bot' }));
    expect(create).toHaveBeenCalledOnce();
    rerender(<BotWelcome creating onCreate={create} />);
    expect(screen.getByRole('button', { name: 'Creating…' }).hasAttribute('disabled')).toBe(true);
  });
});
