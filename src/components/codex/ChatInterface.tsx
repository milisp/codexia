import { useRef, useEffect, type ReactNode } from 'react';
import { useCodexStore } from '@/stores/codex';
import { useIsProcessing } from '@/hooks/codex';
import { ScrollArea } from '@/components/ui/scroll-area';
import { renderEvent } from './items';
import { ApprovalItem } from './items/ApprovalItem';
import { RequestUserInputItem } from './items/RequestUserInputItem';
import { Markdown } from '@/components/Markdown';
import { Composer } from './Composer';
import { CodexAuth } from './CodexAuth';
import { useSettingsStore } from '@/stores/settings';

export function ChatInterface({ hideComposer = false }: { hideComposer?: boolean } = {}) {
  const { currentThreadId, events, hasAccount } = useCodexStore();
  const { taskDetail, showReasoning } = useSettingsStore();
  const isProcessing = useIsProcessing();
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  // Get events for the current thread
  const currentThreadEvents = currentThreadId ? events[currentThreadId] || [] : [];

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ block: 'end' });
  }, [currentThreadEvents]);


  const renderedEvents: Array<{
    key: string;
    type: 'event' | 'reasoningSummaryDelta';
    content?: ReactNode;
    text?: string;
  }> = [];
  let pendingSummary: {
    key: string;
    text: string;
    itemId: string;
    summaryIndex: number;
  } | null = null;
  const seenAgentMessageDeltaItemIds = new Set<string>();
  const seenReasoningTextDeltaItemIds = new Set<string>();
  const seenReasoningSummaryDeltaItemIds = new Set<string>();

  const flushPendingSummary = () => {
    if (pendingSummary) {
      renderedEvents.push({
        key: pendingSummary.key,
        type: 'reasoningSummaryDelta',
        text: pendingSummary.text,
      });
      pendingSummary = null;
    }
  };

  const appendSummaryDelta = (current: string, delta: string) => {
    if (!current) return delta;
    const lastChar = current[current.length - 1];
    const firstChar = delta[0];
    if (/[A-Za-z0-9]$/.test(lastChar) && /^[A-Za-z0-9]/.test(firstChar)) {
      return `${current} ${delta}`;
    }
    return current + delta;
  };

  currentThreadEvents.forEach((event, index) => {
    if (!showReasoning) {
      if (
        event.method === 'item/reasoning/textDelta' ||
        event.method === 'item/reasoning/summaryTextDelta' ||
        (event.method === 'item/completed' && event.params.item.type === 'reasoning')
      ) {
        return;
      }
    }

    if (event.method === 'item/agentMessage/delta') {
      seenAgentMessageDeltaItemIds.add(event.params.itemId);
    } else if (event.method === 'item/reasoning/textDelta') {
      seenReasoningTextDeltaItemIds.add(event.params.itemId);
    }

    if (event.method === 'item/reasoning/summaryTextDelta') {
      seenReasoningSummaryDeltaItemIds.add(event.params.itemId);
      if (!event.params.delta) return;
      const eventKey = `${event.params.itemId}-${event.params.summaryIndex}`;
      if (
        pendingSummary &&
        pendingSummary.itemId === event.params.itemId &&
        pendingSummary.summaryIndex === event.params.summaryIndex
      ) {
        pendingSummary.text = appendSummaryDelta(pendingSummary.text, event.params.delta);
        return;
      }
      flushPendingSummary();
      pendingSummary = {
        key: `summary-${eventKey}-${index}`,
        text: event.params.delta,
        itemId: event.params.itemId,
        summaryIndex: event.params.summaryIndex,
      };
      return;
    }

    if (event.method === 'item/completed') {
      const completedItem = event.params.item;

      if (
        completedItem.type === 'agentMessage' &&
        seenAgentMessageDeltaItemIds.has(completedItem.id)
      ) {
        return;
      }

      if (completedItem.type === 'reasoning') {
        const hasReasoningTextDelta = seenReasoningTextDeltaItemIds.has(completedItem.id);
        const hasVisibleReasoningSummaryDelta =
          showReasoning &&
          taskDetail !== 'steps' &&
          seenReasoningSummaryDeltaItemIds.has(completedItem.id);

        if (hasReasoningTextDelta || hasVisibleReasoningSummaryDelta) {
          return;
        }
      }
    }

    flushPendingSummary();
    const rendered = renderEvent(event, {
      events: currentThreadEvents,
      eventIndex: index,
    });
    if (rendered === null) {
      return;
    }
    renderedEvents.push({
      key: `event-${index}`,
      type: 'event',
      content: rendered,
    });
  });
  flushPendingSummary();

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full relative">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className={`h-full px-4 ${hideComposer ? '' : 'pb-32'}`}>
          <div className="max-w-3xl mx-auto space-y-2 py-4">
            {renderedEvents.map((entry) =>
              entry.type === 'reasoningSummaryDelta' ? (
                <div key={entry.key} className="inline">
                  {showReasoning && taskDetail !== 'steps' && (
                    <Markdown value={entry.text ?? ''} inline />
                  )}
                </div>
              ) : (
                <div key={entry.key}>{entry.content}</div>
              )
            )}
            <ApprovalItem />
            {currentThreadEvents.length === 0 && hasAccount === false && <CodexAuth />}
            {isProcessing && (
              <div className="text-sm text-muted-foreground animate-pulse">Thinking</div>
            )}
            <RequestUserInputItem currentThreadId={currentThreadId} />
            <div ref={bottomAnchorRef} aria-hidden="true" />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      {!hideComposer && (
        <div className="absolute bottom-0 left-0 right-0 px-2 sm:px-0 max-w-3xl mx-auto">
          <Composer />
        </div>
      )}
    </div>
  );
}
