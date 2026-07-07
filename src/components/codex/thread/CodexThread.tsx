import { type ReactNode, useMemo } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useScrollToBottom } from '../hooks';
import { CodexAuth } from '../CodexAuth';
import { renderEvent } from '../items';
import { ApprovalItem } from '../items/ApprovalItem';
import { CommandActionSummaryItem } from '../items/CommandActionSummaryItem';
import { RequestUserInputItem } from '../items/RequestUserInputItem';
import { ScrollToBottomButton } from '../widget/ScrollToBottomButton';
import { WorkingIndicator } from '../widget/WorkingIndicator';
import { deriveRenderItems } from './deriveRenderItems';

interface CodexThreadProps {
  /**
   * When provided, renders this specific thread (e.g. for an embedded card view)
   * instead of the globally active thread from useCodexStore.
   */
  threadId?: string;
  /**
   * Set when embedded in a fixed-height container (e.g. an AgentCard) whose
   * flex-1 ancestor chain doesn't resolve to a definite pixel height for
   * `height: 100%` to latch onto. In that case we skip h-full and let flex-1
   * alone determine the height. Standalone usage (AgentView) keeps h-full,
   * since its ancestor chain does resolve to a definite height.
   */
  fillHeight?: boolean;
}

export function CodexThread({
  threadId,
  fillHeight = true,
}: CodexThreadProps = {}) {
  const { currentThreadId, events, hasAccount, turnTimingMap } = useCodexStore();

  // Use the explicitly provided threadId when embedded, otherwise fall back
  // to the globally active thread.
  const activeThreadId = threadId ?? currentThreadId;

  // Get events for the active thread
  const currentThreadEvents = activeThreadId ? events[activeThreadId] || [] : [];
  const turnTiming = activeThreadId ? turnTimingMap[activeThreadId] : undefined;

  const { scrollAreaRootRef, bottomAnchorRef, isAtBottom, scrollToBottom } =
    useScrollToBottom(currentThreadEvents);

  const renderItems = useMemo(() => deriveRenderItems(currentThreadEvents), [currentThreadEvents]);

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
    <div className={`flex-1 flex flex-col min-h-0 ${fillHeight ? 'h-full' : ''}`}>
      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea ref={scrollAreaRootRef} className="h-full px-4 pb-4">
          <div className="max-w-3xl mx-auto space-y-2 py-4">
            {renderedEvents.map((entry) => (
              <div key={entry.key}>{entry.content}</div>
            ))}
            <ApprovalItem />
            {currentThreadEvents.length === 0 && hasAccount === false && <CodexAuth />}
            <WorkingIndicator turnTiming={turnTiming} />
            <RequestUserInputItem currentThreadId={activeThreadId} />
            <div ref={bottomAnchorRef} aria-hidden="true" />
          </div>
        </ScrollArea>
      </div>

      {/* Scroll-to-bottom button, shown when the view isn't already at the bottom */}
      {!isAtBottom && (
        <ScrollToBottomButton
          onClick={() => scrollToBottom('smooth')}
          bottomClassName="bottom-4"
        />
      )}
    </div>
  );
}