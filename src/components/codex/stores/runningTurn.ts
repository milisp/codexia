import { useCodexStore } from './useCodexStore';

/**
 * Id of the turn currently running on a thread, or null when it is idle.
 *
 * `turnTimingMap` is fed by turn/started, so it also covers turns that the
 * server started itself (queued submissions); `currentTurnId` is only set by
 * client-initiated turns and serves as a fallback.
 */
export function getRunningTurnId(threadId: string | null | undefined): string | null {
  if (!threadId) return null;
  const state = useCodexStore.getState();
  if (state.threadStatusMap[threadId]?.type !== 'active') return null;
  const timing = state.turnTimingMap[threadId];
  if (timing?.status === 'inProgress') return timing.turnId;
  return threadId === state.currentThreadId ? state.currentTurnId : null;
}
