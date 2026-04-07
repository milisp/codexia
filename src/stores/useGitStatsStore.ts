import { create } from 'zustand';
import { gitDiffStats, gitStatus } from '@/services/tauri';

interface GitStats {
  stagedFiles: number;
  unstagedFiles: number;
  stagedAdditions: number;
  stagedDeletions: number;
  unstagedAdditions: number;
  unstagedDeletions: number;
  totalAdditions: number;
  totalDeletions: number;
  isLoading: boolean;
}

interface GitStatsStore {
  stats: GitStats | null;
  setStats: (stats: GitStats | null) => void;
  refreshStats: (cwd: string, silent?: boolean) => Promise<void>;
}

const initialStats: GitStats = {
  stagedFiles: 0,
  unstagedFiles: 0,
  stagedAdditions: 0,
  stagedDeletions: 0,
  unstagedAdditions: 0,
  unstagedDeletions: 0,
  totalAdditions: 0,
  totalDeletions: 0,
  isLoading: false,
};

export const useGitStatsStore = create<GitStatsStore>((set) => ({
  stats: null,

  setStats: (stats) => set({ stats }),

  refreshStats: async (cwd: string, silent = false) => {
    if (!cwd) {
      set({ stats: null });
      return;
    }

    if (!silent) {
      set((state) => ({
        stats: state.stats ? { ...state.stats, isLoading: true } : { ...initialStats, isLoading: true },
      }));
    }

    try {
      const [status, diffStats] = await Promise.all([gitStatus(cwd), gitDiffStats(cwd)]);

      const stagedEntries = status.entries.filter(
        (entry) => entry.index_status !== ' ' && entry.index_status !== '?'
      );

      const unstagedEntries = status.entries.filter(
        (entry) => entry.worktree_status !== ' ' || entry.index_status === '?'
      );
      const stagedAdditions = diffStats.staged.additions;
      const stagedDeletions = diffStats.staged.deletions;
      const unstagedAdditions = diffStats.unstaged.additions;
      const unstagedDeletions = diffStats.unstaged.deletions;
      const totalAdditions = stagedAdditions + unstagedAdditions;
      const totalDeletions = stagedDeletions + unstagedDeletions;

      const nextStats: GitStats = {
        stagedFiles: stagedEntries.length,
        unstagedFiles: unstagedEntries.length,
        stagedAdditions,
        stagedDeletions,
        unstagedAdditions,
        unstagedDeletions,
        totalAdditions,
        totalDeletions,
        isLoading: false,
      };

      set((state) => {
        const prev = state.stats;
        // Skip update if nothing changed during silent background refresh
        if (silent && prev &&
          prev.stagedFiles === nextStats.stagedFiles &&
          prev.unstagedFiles === nextStats.unstagedFiles &&
          prev.totalAdditions === nextStats.totalAdditions &&
          prev.totalDeletions === nextStats.totalDeletions &&
          prev.stagedAdditions === nextStats.stagedAdditions &&
          prev.stagedDeletions === nextStats.stagedDeletions
        ) {
          return state;
        }
        return { stats: nextStats };
      });
    } catch (error) {
      console.error('Failed to refresh git stats:', error);
      if (!silent) {
        set((state) => ({
          stats: state.stats ? { ...state.stats, isLoading: false } : { ...initialStats, isLoading: false },
        }));
      }
    }
  },
}));
