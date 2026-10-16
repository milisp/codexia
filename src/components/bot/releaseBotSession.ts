import { acpStop } from '@/services/apiAdapt/acp';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

/**
 * Let go of a bot's live connection when it holds `sessionId`, because a
 * background run (a sent draft, a finished hand-back) continued that
 * conversation in another process. The process here still has the
 * conversation as it was before the run, so it is stopped; the next message
 * starts a fresh one that loads the whole conversation. Returns whether a
 * connection was released.
 */
export async function releaseBotSession(botId: string, sessionId: string) {
  const ui = useBotUiStore.getState();
  const connection = ui.connectionByBot[botId];
  if (!connection || ui.sessionByBot[botId] !== sessionId) return false;
  await acpStop(connection).catch(() => {});
  useBotUiStore.getState().clearBotConnection(botId);
  const acp = useAcpStore.getState();
  if (acp.connectionId === connection) {
    const agentId = acp.agentId;
    acp.reset();
    acp.setAgentId(agentId);
  }
  return true;
}
