import type { ServerNotification } from '@/bindings';
import type { Thread } from '@/bindings/v2';

/**
 * Converts thread history (turns with items) to ChatEvents for display
 * For each item, we generate both item/started and item/completed events
 * to ensure proper rendering in the UI
 */
export function convertThreadHistoryToEvents(thread: Thread): ServerNotification[] {
  const events: ServerNotification[] = [];

  // Process each turn in the thread
  for (const turn of thread.turns) {
    // Process each item in the turn
    for (const item of turn.items) {
      // Add item/started event
      events.push({
        method: 'item/started',
        params: {
          item: item,
          threadId: thread.id,
          turnId: turn.id,
          startedAtMs: 0,
        },
      });

      // Add item/completed event immediately after
      // This allows the UI to render both the start state and final state
      events.push({
        method: 'item/completed',
        params: {
          item: item,
          threadId: thread.id,
          turnId: turn.id,
          completedAtMs: 0,
        },
      });
    }

    // Mark the turn boundary so the UI flushes per-turn state (e.g. trailing
    // commandExecution groups in deriveRenderItems) instead of bleeding into
    // the next turn's items.
    events.push({
      method: 'turn/completed',
      params: {
        threadId: thread.id,
        turn,
      },
    });
  }

  return events;
}
