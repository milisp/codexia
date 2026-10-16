import { toast } from 'sonner';
import type { ReasoningEffort } from '@/bindings';
import { getRunningTurnId, useCodexStore } from '@/components/codex/stores';
import { codexService } from '@/services/codexService';

export interface RunningTurnSettings {
  model?: string;
  effort?: ReasoningEffort;
}

let pending: RunningTurnSettings | null = null;

async function flush(threadId: string, settings: RunningTurnSettings) {
  // Resolved at flush time: the turn may have ended since the user picked.
  const turnId = getRunningTurnId(threadId);
  if (!turnId) return;
  try {
    const status = await codexService.turnSettingsUpdate(threadId, turnId, settings);
    if (status === 'targetUnavailable') {
      toast.error('The running turn already ended, so this change only applies to the next turn.');
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    toast.error(`Could not change the running turn: ${reason}`);
  }
}

/**
 * Also applies a model / reasoning effort change to the turn currently running
 * on the open thread. Does nothing while the thread is idle: the composer
 * setting is then simply used by the next turn. Changes made in the same tick
 * (a model switch usually adjusts the effort too) go out as one request.
 */
export function applyToRunningTurn(settings: RunningTurnSettings) {
  const threadId = useCodexStore.getState().currentThreadId;
  if (!threadId || !getRunningTurnId(threadId)) return;
  const wasPending = pending !== null;
  pending = { ...pending, ...settings };
  if (wasPending) return;
  queueMicrotask(() => {
    const batch = pending;
    pending = null;
    if (batch) void flush(threadId, batch);
  });
}
