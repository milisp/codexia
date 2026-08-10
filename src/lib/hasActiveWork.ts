import { useCodexStore } from '@/components/codex/stores';
import { listAutomationRuns } from '@/services/apiAdapt';
import { useCCStore } from '@/stores/cc';
import { useAcpStore } from '@/stores/useAcpStore';

/**
 * True when any agent is still working: an active codex turn, a loading
 * claude-code session, a running ACP session, or an automation run that the
 * backend still records as running.
 */
export async function hasActiveWork(): Promise<boolean> {
  const codex = useCodexStore.getState();
  if (Object.values(codex.threadStatusMap).some((status) => status.type === 'active')) return true;
  if (codex.isProcessingQueued) return true;

  if (Object.values(useCCStore.getState().sessionLoadingMap).some(Boolean)) return true;

  if (useAcpStore.getState().running) return true;

  try {
    const runs = await listAutomationRuns({ limit: 100 });
    return runs.some((run) => run.status?.trim().toLowerCase() === 'running');
  } catch {
    // Can't tell — don't block quitting on it.
    return false;
  }
}
