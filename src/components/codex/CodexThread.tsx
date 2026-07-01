import { useRef, useEffect, useState, useMemo, type ReactNode } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { ScrollArea } from '@/components/ui/scroll-area';
import { renderEvent } from './items';
import { ApprovalItem } from './items/ApprovalItem';
import { RequestUserInputItem } from './items/RequestUserInputItem';
import { CommandActionSummaryItem } from './items/CommandActionSummaryItem';
import { Composer } from './composer';
import { CodexAuth } from './CodexAuth';
import { codexService } from '@/services/codexService';
import { Button } from '@/components/ui/button';
import type { CommandAction } from '@/bindings/v2';
import type { ServerNotification } from '@/bindings';
import { WorkingIndicator } from './widget/WorkingIndicator';

// Intermediate render item: either a raw event or an aggregated command group.
type RenderItem =
  | { kind: 'event'; event: ServerNotification; index: number }
  | { kind: 'cmdGroup'; actions: CommandAction[]; key: string; commandItemId?: string | null; aggregatedOutput?: string | null; completed: boolean };

/** Pre-process events into render items, grouping commandExecution runs between agentMessages. */
function deriveRenderItems(events: ServerNotification[]): RenderItem[] {
  const items: RenderItem[] = [];
  let cmdBuffer: CommandAction[] = [];
  let cmdBufferKey = '';
  let cmdItemId: string | null = null;
  let cmdAggregatedOutput: string | null = null;

  const flushCmdBuffer = (completed: boolean) => {
    if (cmdBuffer.length === 0) return;
    items.push({ kind: 'cmdGroup', actions: cmdBuffer, key: cmdBufferKey, commandItemId: cmdItemId, aggregatedOutput: cmdAggregatedOutput, completed });
    cmdBuffer = [];
    cmdBufferKey = '';
    cmdItemId = null;
    cmdAggregatedOutput = null;
  };

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Accumulate commandExecution into buffer — never flush here.
    if (
      event.method === 'item/started' &&
      event.params.item.type === 'commandExecution'
    ) {
      if (cmdBuffer.length === 0) {
        cmdBufferKey = `cmd-${i}`;
        cmdItemId = event.params.item.id;
      }
      cmdBuffer.push(...(event.params.item.commandActions as CommandAction[]));
      continue;
    }

    // Capture aggregatedOutput from completed commandExecution.
    if (
      event.method === 'item/completed' &&
      event.params.item.type === 'commandExecution'
    ) {
      cmdAggregatedOutput = event.params.item.aggregatedOutput ?? null;
      continue;
    }

    // agentMessage started = flush commands that came before it (completed).
    if (
      event.method === 'item/started' &&
      event.params.item.type === 'agentMessage'
    ) {
      flushCmdBuffer(true);
      items.push({ kind: 'event', event, index: i });
      continue;
    }

    // agentMessage completed = just push (content rendered here).
    if (
      event.method === 'item/completed' &&
      event.params.item.type === 'agentMessage'
    ) {
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

export function CodexThread({ hideComposer = false }: { hideComposer?: boolean } = {}) {
  const { currentThreadId, events, hasAccount, activeThreadIds, turnTimingMap } = useCodexStore();
  const isLive = !!currentThreadId && activeThreadIds.includes(currentThreadId);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  // Get events for the current thread
  const currentThreadEvents = currentThreadId ? events[currentThreadId] || [] : [];
  const turnTiming = currentThreadId ? turnTimingMap[currentThreadId] : undefined;

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ block: 'end' });
  }, [currentThreadEvents]);

  const renderItems = useMemo(
    () => deriveRenderItems(currentThreadEvents),
    [currentThreadEvents]
  );

  const seenAgentMessageDeltaItemIds = new Set<string>();
  const renderedEvents: Array<{ key: string; content: ReactNode }> = [];

  for (const item of renderItems) {
    if (item.kind === 'cmdGroup') {
      renderedEvents.push({
        key: item.key,
        content: (
          <CommandActionSummaryItem
            actions={item.actions}
            commandItemId={item.commandItemId}
            aggregatedOutput={item.aggregatedOutput}
            completed={item.completed}
          />
        ),
      });
      continue;
    }

    const { event, index } = item;

    if (event.method === 'item/agentMessage/delta') {
      seenAgentMessageDeltaItemIds.add(event.params.itemId);
    }

    if (event.method === 'item/completed') {
      const completedItem = event.params.item;
      if (
        completedItem.type === 'agentMessage' &&
        seenAgentMessageDeltaItemIds.has(completedItem.id)
      ) {
        continue;
      }
    }

    const rendered = renderEvent(event, { events: currentThreadEvents, eventIndex: index });
    if (rendered === null) continue;
    renderedEvents.push({ key: `event-${index}`, content: rendered });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full relative">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className={`h-full px-4 ${hideComposer ? '' : 'pb-32'}`}>
          <div className="max-w-3xl mx-auto space-y-2 py-4">
            {renderedEvents.map((entry) => (
              <div key={entry.key}>{entry.content}</div>
            ))}
            <ApprovalItem />
            {currentThreadEvents.length === 0 && hasAccount === false && <CodexAuth />}
            <WorkingIndicator turnTiming={turnTiming} />
            <RequestUserInputItem currentThreadId={currentThreadId} />
            <div ref={bottomAnchorRef} aria-hidden="true" />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      {!hideComposer && (
        <div className="absolute bottom-0 left-0 right-0 px-2 sm:px-0 max-w-3xl mx-auto">
          {currentThreadId && !isLive ? (
            <ResumeThreadButton threadId={currentThreadId} />
          ) : (
            <Composer />
          )}
        </div>
      )}
    </div>
  );
}

function ResumeThreadButton({ threadId }: { threadId: string }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await codexService.threadResume(threadId);
    } catch (err) {
      console.error('[ResumeThreadButton] threadResume failed:', err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 p-4 mb-2 rounded-lg border border-border bg-muted/40 text-sm">
      <span className="text-muted-foreground">
        Reviewing history. Resume to send messages.
      </span>
      <Button onClick={onClick} disabled={busy} size="sm">
        {busy ? 'Resuming…' : 'Resume session'}
      </Button>
    </div>
  );
}