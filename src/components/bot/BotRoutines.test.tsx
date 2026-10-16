import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationTask } from '@/services/apiAdapt';
import { useBotUiStore } from '@/stores/useBotUiStore';

const list = vi.fn();
const create = vi.fn();
vi.mock('@/services/apiAdapt', () => ({
  listAutomations: (...args: unknown[]) => list(...args),
  createAutomation: (...args: unknown[]) => create(...args),
  updateAutomation: vi.fn(),
  deleteAutomation: vi.fn(),
  runAutomationNow: vi.fn(),
  setAutomationPaused: vi.fn(),
}));
import { BotRoutines } from './BotRoutines';

const watching = {
  id: 'a1',
  name: 'Review pushes',
  prompt: 'Review the new commits',
  agent: 'bot',
  bot_id: 'scout',
  projects: [],
  schedule: { mode: 'daily', hour: 9, minute: 0, weekdays: [] },
  paused: false,
  trigger: { kind: 'ci_failed', repo: '/work/app' },
  trigger_error: '`gh run list` failed: not logged in',
} as unknown as AutomationTask;

beforeEach(() => {
  vi.clearAllMocks();
  useBotUiStore.setState({ bots: [{ id: 'scout', cwd: '/work/app' } as never] });
});

describe('BotRoutines', () => {
  it('shows what a triggered routine waits for and why it cannot check', async () => {
    list.mockResolvedValue([watching]);
    render(<BotRoutines botId="scout" open />);
    expect(await screen.findByText('When CI fails · app')).toBeTruthy();
    expect(screen.getByText('`gh run list` failed: not logged in')).toBeTruthy();
  });

  it('creates a routine that runs on new commits in the bot’s project', async () => {
    list.mockResolvedValue([]);
    create.mockImplementation(async (task: Record<string, unknown>) => ({ ...task, id: 'new' }));
    render(<BotRoutines botId="scout" open />);
    fireEvent.click(await screen.findByRole('button', { name: /New scheduled task/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Review pushes' } });
    fireEvent.change(screen.getByLabelText('What should this bot do?'), {
      target: { value: 'Review the new commits' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'When something happens' }));
    expect((screen.getByLabelText('Repository') as HTMLInputElement).value).toBe('/work/app');
    fireEvent.change(screen.getByLabelText('Branch'), { target: { value: 'origin/main' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Review pushes',
          agent: 'bot',
          bot_id: 'scout',
          trigger: { kind: 'git_branch', repo: '/work/app', branch: 'origin/main' },
        })
      )
    );
  });
});
