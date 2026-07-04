import type { ServerNotification } from '@/bindings';
import type { CommandAction } from '@/bindings/v2';

/** Intermediate render item: either a raw event or an aggregated command group. */
export type RenderItem =
  | { kind: 'event'; event: ServerNotification; index: number }
  | {
      kind: 'cmdGroup';
      actions: CommandAction[];
      key: string;
      commandItemId?: string | null;
      aggregatedOutput?: string | null;
      completed: boolean;
    };

/** Pre-process events into render items, grouping commandExecution runs between agentMessages. */
export function deriveRenderItems(events: ServerNotification[]): RenderItem[] {
  const items: RenderItem[] = [];
  let cmdBuffer: CommandAction[] = [];
  let cmdBufferKey = '';
  let cmdItemId: string | null = null;
  let cmdAggregatedOutput: string | null = null;

  const flushCmdBuffer = (completed: boolean) => {
    if (cmdBuffer.length === 0) return;
    items.push({
      kind: 'cmdGroup',
      actions: cmdBuffer,
      key: cmdBufferKey,
      commandItemId: cmdItemId,
      aggregatedOutput: cmdAggregatedOutput,
      completed,
    });
    cmdBuffer = [];
    cmdBufferKey = '';
    cmdItemId = null;
    cmdAggregatedOutput = null;
  };

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Accumulate commandExecution into buffer — never flush here.
    if (event.method === 'item/started' && event.params.item.type === 'commandExecution') {
      if (cmdBuffer.length === 0) {
        cmdBufferKey = `cmd-${i}`;
        cmdItemId = event.params.item.id;
      }
      cmdBuffer.push(...(event.params.item.commandActions as CommandAction[]));
      continue;
    }

    // Capture aggregatedOutput from completed commandExecution.
    if (event.method === 'item/completed' && event.params.item.type === 'commandExecution') {
      cmdAggregatedOutput = event.params.item.aggregatedOutput ?? null;
      continue;
    }

    // agentMessage started = flush commands that came before it (completed).
    if (event.method === 'item/started' && event.params.item.type === 'agentMessage') {
      flushCmdBuffer(true);
      items.push({ kind: 'event', event, index: i });
      continue;
    }

    // agentMessage completed = just push (content rendered here).
    if (event.method === 'item/completed' && event.params.item.type === 'agentMessage') {
      items.push({ kind: 'event', event, index: i });
      continue;
    }

    // turn/completed = boundary, flush then push.
    if (event.method === 'turn/completed') {
      flushCmdBuffer(true);
      items.push({ kind: 'event', event, index: i });
      continue;
    }

    // Everything else: just push, never flush.
    items.push({ kind: 'event', event, index: i });
  }

  // Flush trailing buffer (agent still running — not completed yet).
  flushCmdBuffer(false);
  return items;
}
