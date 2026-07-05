import type { StateCreator } from 'zustand';
import type { CodexStore, ThreadsSlice } from './types';

export const createThreadsSlice: StateCreator<CodexStore, [], [], ThreadsSlice> = (set, get) => ({
  threads: [],
  currentThreadId: null,
  currentTurnId: null,
  hasAccount: null,
  activeThreadIds: [],
  inputFocusTrigger: 0,
  threadListNextCursor: null,

  setCurrentThreadId: (id) => {
    set({ currentThreadId: id });
  },

  setThreads: (threads) => {
    set({ threads: threads });
  },

  appendThreads: (threads) => {
    set((state) => {
      if (threads.length === 0) {
        return {};
      }
      const seen = new Set(state.threads.map((thread) => thread.id));
      const merged = [...state.threads];
      for (const thread of threads) {
        if (!seen.has(thread.id)) {
          seen.add(thread.id);
          merged.push(thread);
        }
      }
      return { threads: merged };
    });
  },

  setThreadListNextCursor: (cursor) => {
    set({ threadListNextCursor: cursor });
  },

  setHasAccount: (hasAccount) => {
    set({ hasAccount });
  },

  triggerInputFocus: () => {
    set((state) => ({ inputFocusTrigger: state.inputFocusTrigger + 1 }));
  },

  // Selectors
  getCurrentThread: () => {
    const { currentThreadId, threads } = get();
    if (!currentThreadId) return null;
    return threads.find((t) => t.id === currentThreadId) || null;
  },
});
