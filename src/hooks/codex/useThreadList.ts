import { useCallback, useEffect } from 'react';
import { codexService } from '@/services/codexService';
import { useThreadListStore } from '@/stores/codex';
import { useAgentCenterStore, useLayoutStore, useNoteStore, useWorkspaceStore } from '@/stores';

interface UseThreadListOptions {
  enabled?: boolean;
}

export function useThreadList({ enabled = true }: UseThreadListOptions = {}) {
  const { cwd } = useWorkspaceStore();
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { setView } = useLayoutStore();
  const { setSelectedNoteId } = useNoteStore();
  const { searchTerm, setSearchTerm, sortKey, setSortKey } = useThreadListStore();

  const handleNewThread = useCallback(async () => {
    setSelectedNoteId(null);
    setCurrentAgentCardId(null);
    setView('agent');
    await codexService.setCurrentThread(null);
  }, [setView, setSelectedNoteId, setCurrentAgentCardId]);

  useEffect(() => {
    if (!enabled) return;
    codexService.loadThreads(cwd, false, sortKey);
  }, [enabled, cwd, sortKey]);

  return { searchTerm, setSearchTerm, sortKey, setSortKey, handleNewThread };
}
