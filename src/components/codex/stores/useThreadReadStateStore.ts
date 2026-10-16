import { create } from 'zustand';
import type { ThreadReadState } from '@/bindings/v2';

interface ThreadReadStateStore {
  /** Server read state per thread id. A missing entry means "no unread info" (treated as read). */
  states: Record<string, ThreadReadState>;
  /** Merge the `readStates` map of a `thread/list` response. */
  mergeFromList: (readStates: { [key in string]?: ThreadReadState } | null | undefined) => void;
  setState: (threadId: string, state: ThreadReadState) => void;
}

export const useThreadReadStateStore = create<ThreadReadStateStore>()((set) => ({
  states: {},
  mergeFromList: (readStates) => {
    if (!readStates) return;
    const entries = Object.entries(readStates).filter(
      (entry): entry is [string, ThreadReadState] => entry[1] !== undefined
    );
    if (entries.length === 0) return;
    set((prev) => ({ states: { ...prev.states, ...Object.fromEntries(entries) } }));
  },
  setState: (threadId, state) => set((prev) => ({ states: { ...prev.states, [threadId]: state } })),
}));

export const isThreadUnread = (
  states: Record<string, ThreadReadState>,
  threadId: string
): boolean => (states[threadId]?.firstUnread ?? null) !== null;
