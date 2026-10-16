import { create } from 'zustand';
import { createEventsSlice } from './eventsSlice';
import { createThreadsSlice } from './threadsSlice';
import type { CodexStore } from './types';

export type { CodexStore, TurnTiming } from './types';

export const useCodexStore = create<CodexStore>()((...a) => ({
  ...createThreadsSlice(...a),
  ...createEventsSlice(...a),
}));

export const useCurrentThread = () => useCodexStore((state) => state.getCurrentThread());
