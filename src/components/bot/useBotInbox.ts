import { useCallback, useEffect, useState } from 'react';
import { acpStop } from '@/services/apiAdapt/acp';
import { type BotInboxItem, listBotInbox, resolveBotInbox } from '@/services/apiAdapt/bots';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

export type InboxAction = 'send' | 'discard' | 'done' | 'dismiss';

/**
 * Open drafts and hand-backs, for one bot or every bot. Re-read when the
 * backend says one changed (`bot:inbox`) and when a run ends.
 */
export function useBotInbox(botId?: string) {
  const revision = useBotUiStore((s) => s.inboxRevision);
  const status = useBotUiStore((s) => (botId ? s.statusByBot[botId] : undefined));
  const [items, setItems] = useState<BotInboxItem[]>([]);

  const reload = useCallback(() => {
    listBotInbox(botId)
      .then(setItems)
      .catch((e) => console.error('bots: failed to list inbox', e));
  }, [botId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision and status are the reload signals
  useEffect(() => {
    reload();
  }, [reload, revision, status]);

  return { items, reload };
}

/**
 * Act on an item. Send and Done continue the item's conversation on the
 * backend, which stops any process still holding it; the bot's live
 * connection here is dropped to match, and the next message starts a fresh one.
 */
export async function resolveInboxItem(
  item: BotInboxItem,
  action: InboxAction,
  extra: { body?: string; note?: string } = {}
) {
  const ui = useBotUiStore.getState();
  const continues = action === 'send' || action === 'done';
  const connection = ui.connectionByBot[item.botId];
  const holdsSession = Boolean(connection) && ui.sessionByBot[item.botId] === item.sessionId;
  if (continues && holdsSession && ui.runningByBot[item.botId]) {
    throw new Error('Wait for the current reply to finish, or stop it, first.');
  }
  const resolved = await resolveBotInbox({ id: item.id, action, ...extra });
  if (continues && holdsSession && connection) {
    await acpStop(connection).catch(() => {});
    useBotUiStore.getState().clearBotConnection(item.botId);
    if (useAcpStore.getState().connectionId === connection) {
      const agentId = useAcpStore.getState().agentId;
      useAcpStore.getState().reset();
      useAcpStore.getState().setAgentId(agentId);
    }
  }
  useBotUiStore.getState().bumpInbox();
  return resolved;
}
