import type { StateCreator } from 'zustand';
import type { ServerNotification } from '@/bindings';
import type { ThreadTokenUsage, ThreadGoal } from '@/bindings/v2';
import { compactDeltaEvents } from './eventUtils';
import type { CodexStore, EventsSlice, TurnTiming } from './types';

export const createEventsSlice: StateCreator<CodexStore, [], [], EventsSlice> = (set) => ({
  events: {},
  threadStatusMap: {},
  turnTimingMap: {},
  commandStatusMap: {},
  commandDurationMap: {},
  tokenUsageMap: {},
  goalMap: {},
  goalEnabled: false,

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
          } satisfies TurnTiming,
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
      let goalMap = state.goalMap;
      if (event.method === 'thread/goal/updated') {
        goalMap = { ...goalMap, [threadId]: event.params.goal };
      } else if (event.method === 'thread/goal/cleared') {
        const newGoalMap = { ...goalMap };
        delete newGoalMap[threadId];
        goalMap = newGoalMap;
      }
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
        goalMap,
      };
    });
  },

  setTokenUsage: (threadId: string, data: ThreadTokenUsage) => {
    set((state: CodexStore) => ({
      tokenUsageMap: {
        ...state.tokenUsageMap,
        [threadId]: data,
      },
    }));
  },

  setGoal: (threadId: string, goal: ThreadGoal) => {
    set((state: CodexStore) => ({
      goalMap: {
        ...state.goalMap,
        [threadId]: goal,
      },
    }));
  },

  clearGoal: (threadId: string) => {
    set((state: CodexStore) => {
      const newGoalMap = { ...state.goalMap };
      delete newGoalMap[threadId];
      return { goalMap: newGoalMap };
    });
  },

  setGoalEnabled: (goalEnabled: boolean) => {
    set({ goalEnabled });
  },
});
