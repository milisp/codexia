import { acpCancel, acpNewSession } from '@/services/apiAdapt/acp';
import { useAcpStore } from '@/stores/useAcpStore';

/**
 * Start another session on a live connection, reusing the running agent
 * process instead of spawning the CLI again. Returns false when the connection
 * cannot serve one, so the caller can fall back to a full restart.
 */
export async function acpFreshSession(connectionId: string, cwd: string) {
  const store = useAcpStore.getState();
  try {
    // The previous turn keeps running in the agent otherwise — it is no longer
    // visible anywhere once the pane shows the new session.
    if (store.running) await acpCancel(connectionId, store.sessionId).catch(() => {});
    const session = await acpNewSession(connectionId, cwd);
    store.setEntries([]);
    store.setPermission(null);
    store.setRunning(false);
    store.applySession(session);
    return true;
  } catch (e) {
    console.error('acp: failed to open a new session', e);
    return false;
  }
}
