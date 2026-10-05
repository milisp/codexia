import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Bot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
const save = vi.fn();
vi.mock('./saveBotSettings', () => ({ saveBotSettings: (...args: unknown[]) => save(...args) }));
vi.mock('@/services/apiAdapt/kekeMcp', () => ({
  kekeMcpSelection: (name: string) => `keke:${name}`,
  readKekeMcpServers: vi.fn().mockResolvedValue({github:{type:'http'}, linear:{type:'http'}}),
  readKekeMcpAuthStatuses: vi.fn().mockResolvedValue({}),
}));
import { BotToolsMenu } from './BotToolsMenu';
const bot = { id: 'scout', name: 'Scout', mcpServers: '["keke:github"]' } as Bot;
beforeEach(() => { vi.clearAllMocks(); save.mockResolvedValue(bot); useBotUiStore.setState({ runningByBot: {} }); useLayoutStore.setState({view:'bot'}); });
it('saves switches immediately without Apply or repeated helper text', async () => {
  render(<BotToolsMenu bot={bot} />);
  fireEvent.click(screen.getByRole('button', { name: 'Bot tools' }));
  const linear = await screen.findByRole('switch', {name:'linear'});
  expect(screen.getByRole('switch', {name:'github'}).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(linear);
  await waitFor(() => expect(save).toHaveBeenCalledWith(bot, {mcpServers:['keke:github','keke:linear']}));
  await waitFor(() => expect(linear.getAttribute('aria-checked')).toBe('true'));
  expect(screen.queryByRole('button', {name:'Apply'})).toBeNull();
  expect(screen.queryByText('Choose which tools this bot can use.')).toBeNull();
  expect(screen.queryByText('Configured')).toBeNull();
});
it('keeps the previous switch value when saving fails', async () => {
  save.mockRejectedValueOnce(new Error('offline'));
  render(<BotToolsMenu bot={bot} />);
  fireEvent.click(screen.getByRole('button', {name:'Bot tools'}));
  const linear = await screen.findByRole('switch', {name:'linear'});
  fireEvent.click(linear);
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  await waitFor(() => expect(linear.hasAttribute('disabled')).toBe(false));
  expect(linear.getAttribute('aria-checked')).toBe('false');
});
it('prevents tool changes during a running task', async () => {
  useBotUiStore.setState({runningByBot:{scout:true}});
  render(<BotToolsMenu bot={bot} />);
  fireEvent.click(screen.getByRole('button', {name:'Bot tools'}));
  expect((await screen.findByRole('switch', {name:'linear'})).hasAttribute('disabled')).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
it('opens connector management without an unnecessary save', async () => {
  render(<BotToolsMenu bot={bot} />);
  fireEvent.click(screen.getByRole('button', {name:'Bot tools'}));
  fireEvent.click(await screen.findByRole('button', {name:'Manage'}));
  expect(useLayoutStore.getState().view).toBe('plugins');
  expect(save).not.toHaveBeenCalled();
});
