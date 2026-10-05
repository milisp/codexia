import { beforeEach, expect, it, vi } from 'vitest';
import type { Bot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';
const update = vi.fn();
vi.mock('@/services/apiAdapt/bots', () => ({ updateBot: (...args: unknown[]) => update(...args) }));
vi.mock('@/services/apiAdapt/acp', () => ({ acpStop: vi.fn().mockResolvedValue(undefined) }));
import { saveBotSettings } from './saveBotSettings';
const bot = {id:'scout', agentId:'keke'} as Bot;
beforeEach(() => { vi.clearAllMocks(); useBotUiStore.setState({ bots:[bot], connectionByBot:{}, runningByBot:{}, savingSettingsByBot:{} }); });
it('holds a per-Bot save guard until configuration is persisted', async () => {
  let complete!: (bot: Bot) => void;
  update.mockImplementationOnce(() => new Promise<Bot>((resolve) => {complete = resolve;}));
  const pending = saveBotSettings(bot, {mcpServers:['keke:linear']});
  expect(useBotUiStore.getState().savingSettingsByBot.scout).toBe(true);
  await expect(saveBotSettings(bot, {})).rejects.toThrow();
  expect(update).toHaveBeenCalledOnce();
  complete(bot);
  await pending;
  expect(useBotUiStore.getState().savingSettingsByBot.scout).toBe(false);
});
it('releases the save guard after failure so the user can retry', async () => {
  update.mockRejectedValueOnce(new Error('offline'));
  await expect(saveBotSettings(bot, {})).rejects.toThrow('offline');
  expect(useBotUiStore.getState().savingSettingsByBot.scout).toBe(false);
});
