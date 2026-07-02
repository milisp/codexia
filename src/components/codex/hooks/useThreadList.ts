import { useCallback, useEffect } from 'react';
import { useThreadListStore } from '@/components/codex/stores';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore, useLayoutStore, useWorkspaceStore } from '@/stores';

interface UseThreadListOptions {
  enabled?: boolean;
}

export function useThreadList({ enabled = true }: UseThreadListOptions = {}) {
  const { cwd } = useWorkspaceStore();
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { setView } = useLayoutStore();
  const { searchTerm, setSearchTerm, sortKey, setSortKey } = useThreadListStore();

  const handleNewThread = useCallback(async () => {
    setCurrentAgentCardId(null);
    setView('agent');
    await codexService.setCurrentThread(null);
  }, [setView, setCurrentAgentCardId]);

  useEffect(() => {
    if (!enabled) return;
    codexService.loadThreads(cwd, false, sortKey);
  }, [enabled, cwd, sortKey]);

  return { searchTerm, setSearchTerm, sortKey, setSortKey, handleNewThread };
}
