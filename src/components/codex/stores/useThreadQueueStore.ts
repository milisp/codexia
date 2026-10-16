import { create } from 'zustand';
import type { QueuedSubmission } from '@/bindings/v2';
import { threadQueueList } from '@/services/apiAdapt';

interface ThreadQueueStore {
  /** Server-side queued submissions per thread, in dispatch order. */
  queues: Record<string, QueuedSubmission[]>;
  /** Re-reads the whole queue of a thread from the app-server. */
  refresh: (threadId: string) => Promise<void>;
}

// Latest refresh per thread; a slower, older response must not overwrite a newer one.
const refreshSeq = new Map<string, number>();

export const useThreadQueueStore = create<ThreadQueueStore>()((set) => ({
  queues: {},

  refresh: async (threadId) => {
    const seq = (refreshSeq.get(threadId) ?? 0) + 1;
    refreshSeq.set(threadId, seq);
    try {
      const items: QueuedSubmission[] = [];
      let cursor: string | null = null;
      do {
        const page = await threadQueueList({ threadId, cursor });
        items.push(...page.data);
        cursor = page.nextCursor;
      } while (cursor);
      if (refreshSeq.get(threadId) !== seq) return;
      set((state) => ({ queues: { ...state.queues, [threadId]: items } }));
    } catch (error) {
      console.warn('[useThreadQueueStore] refresh failed:', error);
    }
  },
}));
