import { create } from 'zustand';
import { gitDiffStats, gitStatus } from '@/services/tauri';
import { isGitRepo } from '@/services/tauri/git';

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
  refreshStats: (cwd: string) => Promise<void>;
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

  refreshStats: async (cwd: string) => {
    if (!cwd) {
      set({ stats: null });
      return;
    }

    // Non-git cwds (e.g. claude session that lived in $HOME) — render empty
    // instead of error-flashing. Same gate as useGitWatch's polling.
    if (!(await isGitRepo(cwd))) {
      set({ stats: null });
      return;
    }

    set((state) => ({
      stats: state.stats ? { ...state.stats, isLoading: true } : { ...initialStats, isLoading: true },
    }));

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

      set({
        stats: {
          stagedFiles: stagedEntries.length,
          unstagedFiles: unstagedEntries.length,
          stagedAdditions,
          stagedDeletions,
          unstagedAdditions,
          unstagedDeletions,
          totalAdditions,
          totalDeletions,
          isLoading: false,
        },
      });
    } catch (error) {
      console.error('Failed to refresh git stats:', error);
      set((state) => ({
        stats: state.stats ? { ...state.stats, isLoading: false } : { ...initialStats, isLoading: false },
      }));
    }
  },
}));
