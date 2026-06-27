import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SortKey = 'created_at' | 'updated_at';

interface ThreadListState {
  searchTerm: string;
  showCreatedAt: boolean;
  sortKey: SortKey;
  setSearchTerm: (term: string) => void;
  setShowCreatedAt: (show: boolean) => void;
  setSortKey: (key: SortKey) => void;
}

export const useThreadListStore = create<ThreadListState>()(
  persist(
    (set) => ({
      searchTerm: '',
      showCreatedAt: false,
      sortKey: 'updated_at',
      setSearchTerm: (term) => set({ searchTerm: term }),
      setShowCreatedAt: (show) => set({ showCreatedAt: show }),
      setSortKey: (key) => set({ sortKey: key }),
    }),
    {
      name: 'thread-list-storage',
      version: 2,
    }
  )
);
