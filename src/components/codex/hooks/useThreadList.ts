import { useEffect } from 'react';
import { useThreadListStore } from '@/components/codex/stores';
import { codexService } from '@/services/codexService';
import { useWorkspaceStore } from '@/stores';

interface UseThreadListOptions {
  enabled?: boolean;
}

export function useThreadList({ enabled = true }: UseThreadListOptions = {}) {
  const { cwd } = useWorkspaceStore();
  const { searchTerm, setSearchTerm, sortKey, setSortKey } = useThreadListStore();

  useEffect(() => {
    if (!enabled) return;
    codexService.loadThreads(cwd, false, sortKey);
  }, [enabled, cwd, sortKey]);

  return { searchTerm, setSearchTerm, sortKey, setSortKey };
}
