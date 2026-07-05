import { create } from 'zustand';
import { createThreadsSlice } from './threadsSlice';
import { createEventsSlice } from './eventsSlice';
import { createQueueSlice } from './queueSlice';
import type { CodexStore } from './types';

export type { CodexStore, TurnTiming } from './types';

export const useCodexStore = create<CodexStore>()((...a) => ({
  ...createThreadsSlice(...a),
  ...createEventsSlice(...a),
  ...createQueueSlice(...a),
}));

export const useCurrentThread = () => useCodexStore((state) => state.getCurrentThread());
