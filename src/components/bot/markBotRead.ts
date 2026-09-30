import { type Bot, updateBot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';

/**
 * Clear a bot's unread badge. A no-op when there is nothing unread, so opening
 * a bot costs no round-trip in the common case.
 */
export async function markBotRead(bot: Pick<Bot, 'id' | 'unreadCount'>) {
  if (!bot.unreadCount) return;
  try {
    const updated = await updateBot(bot.id, {
      unreadCount: 0,
      lastViewedAt: new Date().toISOString(),
    });
    useBotUiStore.getState().upsertBot(updated);
  } catch (e) {
    console.error('bots: failed to mark read', e);
  }
}
