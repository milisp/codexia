import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bot } from '@/services/apiAdapt/bots';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
const update = vi.fn();
const stop = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/apiAdapt/bots', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/apiAdapt/bots')>()), updateBot: (...args: unknown[]) => update(...args), deleteBot: vi.fn() }));
vi.mock('@/services/apiAdapt/acp', () => ({ acpStop: (...args: unknown[]) => stop(...args) }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('./BotIdentityFields', () => ({ BotIdentityFields: () => null }));
vi.mock('./BotModelFields', () => ({ BotModelFields: () => null }));
vi.mock('./BotTrustFields', () => ({ BotTrustFields: () => null }));
vi.mock('./BotCollaborationFields', () => ({ BotCollaborationFields: () => null }));
import { BotSettingsDialog } from './BotSettingsDialog';
const bot = { id: 'bot', name: 'Scout', agentId: 'keke' } as Bot;
beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue(bot);
  useBotUiStore.setState({ bots: [bot], selectedBotId: 'bot', connectionByBot: {}, sessionByBot: {}, runningByBot: {} });
  useAcpStore.getState().reset();
  useLayoutStore.setState({ view: 'bot' });
});
describe('Bot settings', () => {
  it('saves settings without overwriting independently managed MCP access', async () => {
    const close = vi.fn();
    render(<BotSettingsDialog bot={bot} open onOpenChange={close} />);
    expect(screen.queryByRole('button', { name: 'Save & manage tools' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0]).toBe('bot');
    expect(update.mock.calls[0][1]).not.toHaveProperty('mcpServers');
    expect(close).toHaveBeenCalledWith(false);
    expect(useLayoutStore.getState().view).toBe('bot');
  });
  it('keeps settings open and stays on the Bot when saving fails', async () => {
    update.mockRejectedValueOnce(new Error('offline'));
    const close = vi.fn();
    render(<BotSettingsDialog bot={bot} open onOpenChange={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false));
    expect(useLayoutStore.getState().view).toBe('bot');
    expect(close).not.toHaveBeenCalled();
  });
  it('stops an idle runtime so the next task uses new tool permissions', async () => {
    useBotUiStore.setState({ connectionByBot: { bot: 'old' }, sessionByBot: { bot: 'session' } });
    useAcpStore.getState().setConnection({ connectionId: 'old', sessionId: 'session', agentTitle: 'Scout', authMethods: [] });
    render(<BotSettingsDialog bot={bot} open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(stop).toHaveBeenCalledWith('old');
    expect(useBotUiStore.getState().connectionByBot.bot).toBeUndefined();
    expect(useBotUiStore.getState().sessionByBot.bot).toBeUndefined();
    expect(useAcpStore.getState().connectionId).toBeNull();
  });
});
