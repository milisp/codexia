import { create } from 'zustand';
import type { ServerNotification } from '@/bindings';
import type { CommandExecutionStatus, Thread, ThreadStatus, ThreadTokenUsage } from '@/bindings/v2';
import { codexService } from '@/services/codexService';

/**
 * Per-thread turn timing, tracked as the single source of truth for
 * "how long is this turn taking / how long did it take".
 *
 * Sourced directly from turn/started + turn/completed + error notifications,
 * independent of thread/status/changed. thread/status/changed only carries
 * active/idle/error flags with no timestamps, and can race with turn events
 * (e.g. on error/interrupt), so deriving elapsed time by scanning the raw
 * events array for turn/started vs turn/completed produced stale/incorrect
 * timers when the two streams disagreed. Keeping timing here, updated
 * directly by the turn lifecycle events, removes that race entirely.
 */
export interface TurnTiming {
  turnId: string;
  /** ms since epoch, from turn/started's turn.startedAt (server clock). */
  startedAtMs: number;
  /** Set once the turn completes/fails/is interrupted (turn/completed). */
  durationMs: number | null;
  /** Last known turn status; 'inProgress' while active. */
  status: 'inProgress' | 'completed' | 'interrupted' | 'failed';
}

type DeltaMethod = 'item/agentMessage/delta';

type DeltaEvent = Extract<ServerNotification, { method: DeltaMethod }>;

const isDeltaEvent = (event: ServerNotification): event is DeltaEvent => {
  return event.method === 'item/agentMessage/delta';
};

const canCompactDeltaEvents = (previous: DeltaEvent, incoming: DeltaEvent): boolean => {
  if (previous.method !== incoming.method) {
    return false;
  }

  switch (incoming.method) {
    case 'item/agentMessage/delta':
      return (
        previous.params.threadId === incoming.params.threadId &&
        previous.params.turnId === incoming.params.turnId &&
        previous.params.itemId === incoming.params.itemId
      );
    default:
      return true;
  }
};

const compactDeltaEvents = (
  events: ServerNotification[],
  incoming: ServerNotification
): ServerNotification[] => {
  const previous = events[events.length - 1];
  if (!previous || !isDeltaEvent(previous) || !isDeltaEvent(incoming)) {
    return [...events, incoming];
  }

  if (!canCompactDeltaEvents(previous, incoming)) {
    return [...events, incoming];
  }

  const compacted = {
    ...incoming,
    params: {
      ...incoming.params,
      delta: `${previous.params.delta}${incoming.params.delta}`,
    },
  } as ServerNotification;

  return [...events.slice(0, -1), compacted];
};

interface CodexStore {
  // State
  threads: Thread[];
  currentThreadId: string | null;
  currentTurnId: string | null;
  hasAccount: boolean | null;
  events: Record<string, ServerNotification[]>; // Events per thread
  /** Per-thread status derived from thread/status/changed (authoritative) and turn events (fallback) */
  threadStatusMap: Record<string, ThreadStatus>;
  /** Per-thread timing of the most recent turn, see TurnTiming for why this is separate from threadStatusMap. */
  turnTimingMap: Record<string, TurnTiming>;
  /** Command status map: itemId -> CommandExecutionStatus */
  commandStatusMap: Record<string, CommandExecutionStatus>;
  /** Command duration map: itemId -> durationMs, populated on item/completed for commandExecution. */
  commandDurationMap: Record<string, number | null>;
  activeThreadIds: string[]; // Track resumed/active threads
  inputFocusTrigger: number; // Increment to trigger focus in InputArea
  threadListNextCursor: string | null;
  /** Per-thread token usage from thread/tokenUsage/updated */
  tokenUsageMap: Record<string, ThreadTokenUsage>;
  /** Queue for messages that arrived while thread was busy */
  queuedMessages: Array<{ text: string; images: string[] }>;
  /** Flag to prevent processing multiple queued messages simultaneously */
  isProcessingQueued: boolean;

  // Basic Setters
  setCurrentThreadId: (id: string | null) => void;
  setThreads: (threads: Thread[]) => void;
  appendThreads: (threads: Thread[]) => void;
  setThreadListNextCursor: (cursor: string | null) => void;
  setHasAccount: (hasAccount: boolean | null) => void;
  addEvent: (threadId: string, event: ServerNotification) => void;
  triggerInputFocus: () => void;
  setTokenUsage: (threadId: string, data: ThreadTokenUsage) => void;
  // Queue management
  queueMessage: (text: string, images: string[]) => void;
  getQueuedMessages: () => Array<{ text: string; images: string[] }>;
  clearQueue: () => void;
  removeQueuedMessage: (index: number) => void;
  processQueue: () => Promise<void>;
  setProcessingQueued: (isProcessing: boolean) => void;
  // Selectors
  getCurrentThread: () => Thread | null;
}

export const useCodexStore = create<CodexStore>((set, get) => ({
  threads: [],
  currentThreadId: null,
  currentTurnId: null,
  hasAccount: null,
  events: {},
  threadStatusMap: {},
  turnTimingMap: {},
  commandStatusMap: {},
  commandDurationMap: {},
  activeThreadIds: [],
  inputFocusTrigger: 0,
  threadListNextCursor: null,
  tokenUsageMap: {},
  queuedMessages: [],
  isProcessingQueued: false,

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

  addEvent: (threadId: string, event: ServerNotification) => {
    set((state: CodexStore) => {
      const existingEvents = state.events[threadId] || [];

      // Deduplicate turn/diff/updated events
      // If this is a turn/diff/updated event, remove previous ones with the same turnId
      let filteredEvents = existingEvents;
      if (event.method === 'turn/diff/updated') {
        const newTurnId = event.params.turnId;
        filteredEvents = existingEvents.filter((e) => {
          if (e.method !== 'turn/diff/updated') return true;
          const existingTurnId = e.params.turnId;
          return existingTurnId !== newTurnId;
        });
      }

      const compactedEvents = compactDeltaEvents(filteredEvents, event);

      const newEvents = {
        ...state.events,
        [threadId]: compactedEvents,
      };

      let threadStatusMap = state.threadStatusMap;
      if (event.method === 'thread/status/changed') {
        threadStatusMap = { ...threadStatusMap, [threadId]: event.params.status };
      }

      // Update turn timing map: single source of truth for turn elapsed/duration,
      // independent of thread/status/changed (see TurnTiming doc comment).
      let turnTimingMap = state.turnTimingMap;
      if (event.method === 'turn/started') {
        const { turn } = event.params;
        turnTimingMap = {
          ...turnTimingMap,
          [threadId]: {
            turnId: turn.id,
            startedAtMs: typeof turn.startedAt === 'number' ? turn.startedAt * 1000 : Date.now(),
            durationMs: null,
            status: 'inProgress',
          },
        };
      } else if (event.method === 'turn/completed') {
        const { turn } = event.params;
        const existing = turnTimingMap[threadId];
        // Only update if this completion matches the turn we're tracking (or we have none tracked).
        if (!existing || existing.turnId === turn.id) {
          turnTimingMap = {
            ...turnTimingMap,
            [threadId]: {
              turnId: turn.id,
              startedAtMs:
                existing?.startedAtMs ??
                (typeof turn.startedAt === 'number' ? turn.startedAt * 1000 : Date.now()),
              durationMs: turn.durationMs,
              status: turn.status === 'inProgress' ? 'completed' : turn.status,
            },
          };
        }
      } else if (event.method === 'error') {
        // Standalone error notification: if it targets the turn we're tracking
        // and no turn/completed has landed yet, mark it failed so the UI stops
        // showing "Working..." even if turn/completed never arrives.
        const existing = turnTimingMap[threadId];
        if (
          existing &&
          existing.turnId === event.params.turnId &&
          existing.status === 'inProgress'
        ) {
          turnTimingMap = {
            ...turnTimingMap,
            [threadId]: {
              ...existing,
              durationMs: Date.now() - existing.startedAtMs,
              status: 'failed',
            },
          };
        }
      }

      // Update command status map
      let commandStatusMap = state.commandStatusMap;
      let commandDurationMap = state.commandDurationMap;
      if (event.method === 'item/started' && event.params.item?.type === 'commandExecution') {
        commandStatusMap = {
          ...commandStatusMap,
          [event.params.item.id]: event.params.item.status,
        };
      } else if (
        event.method === 'item/completed' &&
        event.params.item?.type === 'commandExecution'
      ) {
        commandStatusMap = {
          ...commandStatusMap,
          [event.params.item.id]: event.params.item.status,
        };
        commandDurationMap = {
          ...commandDurationMap,
          [event.params.item.id]: event.params.item.durationMs,
        };
      }

      return {
        events: newEvents,
        threadStatusMap,
        turnTimingMap,
        commandStatusMap,
        commandDurationMap,
      };
    });
  },

  triggerInputFocus: () => {
    set((state: CodexStore) => ({ inputFocusTrigger: state.inputFocusTrigger + 1 }));
  },

  setTokenUsage: (threadId: string, data: ThreadTokenUsage) => {
    set((state: CodexStore) => ({
      tokenUsageMap: {
        ...state.tokenUsageMap,
        [threadId]: data,
      },
    }));
  },

  // Queue management
  queueMessage: (text: string, images: string[]) => {
    set((state: CodexStore) => ({
      queuedMessages: [...state.queuedMessages, { text, images }],
    }));
  },

  getQueuedMessages: () => {
    return get().queuedMessages;
  },

  clearQueue: () => {
    set({ queuedMessages: [] });
  },

  removeQueuedMessage: (index: number) => {
    set((state: CodexStore) => {
      const newQueue = [...state.queuedMessages];
      newQueue.splice(index, 1);
      return { queuedMessages: newQueue };
    });
  },

  processQueue: async () => {
    // Prevent concurrent processing
    if (get().isProcessingQueued) {
      return;
    }

    set({ isProcessingQueued: true });

    try {
      // Process all queued messages
      while (get().queuedMessages.length > 0) {
        const { text, images } = get().queuedMessages[0];

        // Remove from queue
        set((state: CodexStore) => ({
          queuedMessages: state.queuedMessages.slice(1),
        }));

        // Skip if empty
        if (!text.trim() && images.length === 0) {
          continue;
        }

        // Get current thread ID
        const { currentThreadId } = get();
        if (!currentThreadId) {
          // No active thread, start a new one
          const thread = await codexService.threadStart();

          // Start turn with the message
          await codexService.turnStart(thread.id, text, images);
        } else {
          // We have an active thread, just start the turn
          await codexService.turnStart(currentThreadId, text, images);
        }

        // Small delay to prevent overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing queued messages:', error);
    } finally {
      set({ isProcessingQueued: false });
    }
  },

  setProcessingQueued: (isProcessing) => {
    set({ isProcessingQueued: isProcessing });
  },

  // Selectors
  getCurrentThread: () => {
    const { currentThreadId, threads } = get();
    if (!currentThreadId) return null;
    return threads.find((t) => t.id === currentThreadId) || null;
  },
}));

export const useCurrentThread = () => useCodexStore((state) => state.getCurrentThread());
