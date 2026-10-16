import type { ServerNotification } from '@/bindings';
import { isStepItem } from '../items/stepItems';
import type { StepEntry } from '../items/ThreadStepChain';

/** Intermediate render item: either a raw event or a chain of consecutive steps. */
export type RenderItem =
  | { kind: 'event'; event: ServerNotification; index: number }
  | { kind: 'chain'; key: string; steps: StepEntry[] };

// Events that render something other than a step, so they end the current chain.
function endsChain(event: ServerNotification): boolean {
  switch (event.method) {
    case 'item/started':
    case 'item/completed':
      return !isStepItem(event.params.item);
    case 'error':
    case 'warning':
    case 'turn/started':
    case 'turn/completed':
    case 'turn/plan/updated':
    case 'item/agentMessage/delta':
    case 'item/commandExecution/terminalInteraction':
      return true;
    default:
      return false;
  }
}

/**
 * Pre-process events into render items. Consecutive step items (thinking, commands, tool
 * calls) between messages are grouped into one chain; an `item/started` that has a matching
 * `item/completed` is folded into it, so each step shows once.
 */
export function deriveRenderItems(events: ServerNotification[]): RenderItem[] {
  const completedItemIds = new Set<string>();
  const completedTurnIds = new Set<string>();
  for (const event of events) {
    if (event.method === 'item/completed') completedItemIds.add(event.params.item.id);
    if (event.method === 'turn/completed') completedTurnIds.add(event.params.turn.id);
  }

  const items: RenderItem[] = [];
  let chain: Extract<RenderItem, { kind: 'chain' }> | null = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event.method === 'item/started' || event.method === 'item/completed') {
      const { item } = event.params;
      if (isStepItem(item)) {
        const started = event.method === 'item/started';
        if (started && completedItemIds.has(item.id)) continue;
        if (!chain) {
          chain = { kind: 'chain', key: `chain-${i}`, steps: [] };
          items.push(chain);
        }
        // A step that never completed is only live while its turn is still open.
        const running = started && !completedTurnIds.has(event.params.turnId);
        chain.steps.push({ item, running });
        continue;
      }
    }

    if (endsChain(event)) chain = null;
    items.push({ kind: 'event', event, index: i });
  }

  return items;
}
