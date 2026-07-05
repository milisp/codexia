import { type ReactNode, useMemo } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useScrollToBottom } from '../hooks';
import { CodexAuth } from '../CodexAuth';
import { Composer } from '../composer';
import { renderEvent } from '../items';
import { ApprovalItem } from '../items/ApprovalItem';
import { CommandActionSummaryItem } from '../items/CommandActionSummaryItem';
import { RequestUserInputItem } from '../items/RequestUserInputItem';
import { ScrollToBottomButton } from '../widget/ScrollToBottomButton';
import { WorkingIndicator } from '../widget/WorkingIndicator';
import { deriveRenderItems } from './deriveRenderItems';

export function CodexThread({ hideComposer = false }: { hideComposer?: boolean } = {}) {
  const { currentThreadId, events, hasAccount, turnTimingMap } = useCodexStore();

  // Get events for the current thread
  const currentThreadEvents = currentThreadId ? events[currentThreadId] || [] : [];
  const turnTiming = currentThreadId ? turnTimingMap[currentThreadId] : undefined;

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
    <div className="flex-1 flex flex-col min-h-0 h-full relative">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea ref={scrollAreaRootRef} className={`h-full px-4 ${hideComposer ? '' : 'pb-32'}`}>
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

      {/* Scroll-to-bottom button, shown when the view isn't already at the bottom */}
      {!isAtBottom && (
        <ScrollToBottomButton
          onClick={() => scrollToBottom('smooth')}
          bottomClassName={hideComposer ? 'bottom-4' : 'bottom-36'}
        />
      )}

      {/* Input Area */}
      {!hideComposer && (
        <div className="absolute bottom-0 left-0 right-0 px-2 sm:px-0 max-w-3xl mx-auto">
          <Composer />
        </div>
      )}
    </div>
  );
}