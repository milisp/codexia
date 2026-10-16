import { Fragment, type ReactNode, useMemo } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useScrollToBottom } from '../hooks';
import { EventItem } from '../items';
import { ApprovalItem } from '../items/ApprovalItem';
import { ElicitationItem } from '../items/ElicitationItem';
import { PermissionsItem } from '../items/PermissionsItem';
import { RequestUserInputItem } from '../items/RequestUserInputItem';
import { ThreadStepChain } from '../items/ThreadStepChain';
import { ScrollToBottomButton } from '../widget/ScrollToBottomButton';
import { WorkingIndicator } from '../widget/WorkingIndicator';
import { deriveRenderItems } from './deriveRenderItems';

interface CodexThreadProps {
  /**
   * When provided, renders this specific thread instead of the globally
   * active thread from useCodexStore.
   */
  threadId?: string;
}

export function CodexThread({ threadId }: CodexThreadProps = {}) {
  const { currentThreadId, events, turnTimingMap, retryNoticeMap } = useCodexStore();

  // Use the explicitly provided threadId when embedded, otherwise fall back
  // to the globally active thread.
  const activeThreadId = threadId ?? currentThreadId;

  // Get events for the active thread
  const currentThreadEvents = activeThreadId ? events[activeThreadId] || [] : [];
  const turnTiming = activeThreadId ? turnTimingMap[activeThreadId] : undefined;
  const retryNotice = activeThreadId ? retryNoticeMap[activeThreadId] : undefined;

  const { scrollAreaRootRef, bottomAnchorRef, isAtBottom, scrollToBottom } =
    useScrollToBottom(currentThreadEvents);

  const renderItems = useMemo(() => deriveRenderItems(currentThreadEvents), [currentThreadEvents]);

  const seenAgentMessageDeltaItemIds = new Set<string>();
  const renderedEvents: Array<{ key: string; content: ReactNode }> = [];

  for (const item of renderItems) {
    if (item.kind === 'chain') {
      renderedEvents.push({
        key: item.key,
        content: <ThreadStepChain steps={item.steps} />,
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

    renderedEvents.push({
      key: `event-${index}`,
      content: (
        <EventItem event={event} context={{ events: currentThreadEvents, eventIndex: index }} />
      ),
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea ref={scrollAreaRootRef} className="h-full px-4 pb-4">
          <div className="thread-surface max-w-3xl mx-auto space-y-2 py-4">
            {renderedEvents.map((entry) => (
              <Fragment key={entry.key}>{entry.content}</Fragment>
            ))}
            <ApprovalItem />
            <WorkingIndicator turnTiming={turnTiming} retryNotice={retryNotice} />
            <RequestUserInputItem currentThreadId={activeThreadId} />
            <ElicitationItem currentThreadId={activeThreadId} />
            <PermissionsItem currentThreadId={activeThreadId} />
            <div ref={bottomAnchorRef} aria-hidden="true" />
          </div>
        </ScrollArea>
      </div>

      {/* Scroll-to-bottom button, shown when the view isn't already at the bottom */}
      {!isAtBottom && (
        <ScrollToBottomButton onClick={() => scrollToBottom('smooth')} bottomClassName="bottom-4" />
      )}
    </div>
  );
}
