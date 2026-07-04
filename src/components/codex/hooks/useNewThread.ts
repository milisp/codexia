import { useCallback } from 'react';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore, useLayoutStore } from '@/stores';

/**
 * Starts a new (empty) Codex thread: clears the current agent card,
 * switches to the agent view, and resets the active thread.
 */
export function useNewThread() {
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { setView } = useLayoutStore();

  const handleNewThread = useCallback(async () => {
    setCurrentAgentCardId(null);
    setView('agent');
    await codexService.setCurrentThread(null);
  }, [setView, setCurrentAgentCardId]);

  return { handleNewThread };
}
