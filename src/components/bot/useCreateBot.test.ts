import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBotUiStore } from '@/stores/useBotUiStore';
import type { BotTemplate } from './botTemplates';
import { useCreateBot } from './useCreateBot';

const createBot = vi.fn();
const updateBot = vi.fn();
vi.mock('@/services/apiAdapt/bots', () => ({
  createBot: (...args: unknown[]) => createBot(...args),
  updateBot: (...args: unknown[]) => updateBot(...args),
}));
vi.mock('@/services/apiAdapt/automation', () => ({ createAutomation: vi.fn() }));

const role = { name: 'Daily Brief', title: 'Briefs', prompt: 'p', avatar: 'a', color: 'c' } as BotTemplate;

describe('useCreateBot', () => {
  beforeEach(() => {
    useBotUiStore.setState({ bots: [] });
    createBot.mockReset().mockImplementation(async (bot) => ({ ...bot, agentId: 'keke' }));
    updateBot.mockReset().mockImplementation(async (id, patch) => ({ id, agentId: 'keke', ...patch }));
  });

  it('lands a role in its chat without opening settings', async () => {
    const { result } = renderHook(() => useCreateBot());
    await act(() => result.current.createFrom(role, []));
    expect(result.current.newBot).toBeNull();
  });

  it('opens settings for a blank bot so it can be described', async () => {
    const { result } = renderHook(() => useCreateBot());
    await act(() => result.current.createFrom(null, []));
    expect(result.current.newBot?.name).toBe('Bot 1');
  });
});
