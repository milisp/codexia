import { acpStop } from '@/services/apiAdapt/acp';
import { type Bot, type BotPatch, updateBot } from '@/services/apiAdapt/bots';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

/** Restart idle runtimes on the next task so tool access matches the saved Bot. */
export async function saveBotSettings(bot: Bot, patch: BotPatch) {
  if (
    useBotUiStore.getState().runningByBot[bot.id] ||
    useBotUiStore.getState().savingSettingsByBot[bot.id]
  ) {
    throw new Error('Stop the current task before changing tools or settings.');
  }
  useBotUiStore.getState().setSavingSettings(bot.id, true);
  try {
    const connection = useBotUiStore.getState().connectionByBot[bot.id];
    if (connection) {
      await acpStop(connection);
      useBotUiStore.getState().clearBotConnection(bot.id);
      if (useAcpStore.getState().connectionId === connection) {
        useAcpStore.getState().reset();
        useAcpStore.getState().setAgentId(bot.agentId);
      }
    }
    const updated = await updateBot(bot.id, patch);
    useBotUiStore.getState().upsertBot(updated);
    return updated;
  } finally {
    useBotUiStore.getState().setSavingSettings(bot.id, false);
  }
}
