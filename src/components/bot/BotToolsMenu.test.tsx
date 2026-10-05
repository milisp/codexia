import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Bot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
const save = vi.fn();
vi.mock('./saveBotSettings', () => ({ saveBotSettings: (...args: unknown[]) => save(...args) }));
vi.mock('./BotMcpFields', () => ({ BotMcpFields: ({ mcpServers, onMcpServersChange, onManageTools }: {
  mcpServers: string[]; onMcpServersChange: (names: string[]) => void; onManageTools: () => void;
}) => <><span>{mcpServers.join(',')}</span><button type="button" onClick={() => onMcpServersChange(['keke:linear'])}>Select Linear</button><button type="button" onClick={onManageTools}>Save & manage tools</button></> }));
import { BotToolsMenu } from './BotToolsMenu';
const bot = { id: 'scout', name: 'Scout', mcpServers: '["keke:github"]' } as Bot;
beforeEach(() => { vi.clearAllMocks(); save.mockResolvedValue(bot); useBotUiStore.setState({ runningByBot: {} }); useLayoutStore.setState({view:'bot'}); });
it('opens from Plus and saves tools for the Bot through Apply', async () => {
  render(<BotToolsMenu bot={bot} />);
  fireEvent.click(screen.getByRole('button', { name: 'Bot tools' }));
  expect(await screen.findByText('keke:github')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: 'Select Linear'}));
  fireEvent.click(screen.getByRole('button', {name: 'Apply'}));
  await waitFor(() => expect(save).toHaveBeenCalledWith(bot, {mcpServers:['keke:linear']}));
  await waitFor(() => expect(screen.queryByText('Tools for Scout')).toBeNull());
});
it('keeps the picker open after a failed save and prevents navigation', async () => {
  save.mockRejectedValueOnce(new Error('offline'));
  render(<BotToolsMenu bot={bot} />);
  fireEvent.click(screen.getByRole('button', {name:'Bot tools'}));
  fireEvent.click(await screen.findByRole('button', {name:'Save & manage tools'}));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(useLayoutStore.getState().view).toBe('bot');
  expect(screen.getByText('Tools for Scout')).toBeTruthy();
});
it('prevents tool changes during a running task', async () => {
  useBotUiStore.setState({runningByBot:{scout:true}});
  render(<BotToolsMenu bot={bot} />);
  fireEvent.click(screen.getByRole('button', {name:'Bot tools'}));
  expect((await screen.findByRole('button', {name:'Apply'})).hasAttribute('disabled')).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
