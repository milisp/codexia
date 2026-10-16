import { useTranslation } from 'react-i18next';
import type { ServerNotification } from '@/bindings';
import type { FileUpdateChange } from '@/bindings/v2';
import { Badge } from '@/components/ui/badge';
import { AgentMessageItem } from './AgentMessageItem';
import {
  aggregateFileChanges,
  aggregateTurnChangesFromContext,
  getChangeCounts,
  getDiffViewerProps,
  type RenderEventContext,
} from './fileChangeLogic';
import { IndividualFileChanges } from './IndividualFileChanges';
import { isStepItem } from './stepItems';
import { ThreadFileChangesSummary } from './ThreadFileChangesSummary';
import { ThreadStepChain } from './ThreadStepChain';
import { PlanTextItem, TurnPlan } from './TurnPlan';
import { EditableUserMessageItem } from './UserMessageItem';

type EventItemProps = {
  event: ServerNotification;
  context?: RenderEventContext;
};

// True when the transcript already holds the `item/completed` for this item id.
const isItemCompleted = (itemId: string, context?: RenderEventContext) =>
  !!context?.events?.some(
    (candidate) => candidate.method === 'item/completed' && candidate.params.item.id === itemId
  );

export const EventItem = ({ event, context }: EventItemProps) => {
  const { t } = useTranslation('thread');
  const fileChangeMap = {
    add: t('fileChanges.created'),
    delete: t('fileChanges.deleted'),
    update: t('fileChanges.edited'),
  };

  const renderFileChanges = (changes: FileUpdateChange[]) => (
    <IndividualFileChanges
      changes={changes}
      fileChangeMap={fileChangeMap}
      getChangeCounts={getChangeCounts}
      getDiffViewerProps={getDiffViewerProps}
    />
  );
  switch (event.method) {
    case 'error':
      return (
        <p className="text-red-600 dark:text-red-400 font-medium">{event.params.error.message}</p>
      );
    case 'warning':
      return (
        <p className="text-yellow-600 dark:text-yellow-400 font-medium">{event.params.message}</p>
      );
    case 'item/started': {
      const { item: startedItem } = event.params;
      switch (startedItem.type) {
        case 'userMessage': {
          const threadId = event.params.threadId;
          const turnId = event.params.turnId;

          return (
            <EditableUserMessageItem
              content={startedItem.content}
              threadId={threadId}
              turnId={turnId}
            />
          );
        }
        case 'agentMessage':
        case 'enteredReviewMode':
        case 'fileChange':
          return null;
        default:
          // A step that already completed is rendered from its `item/completed`.
          return isStepItem(startedItem) && !isItemCompleted(event.params.item.id, context) ? (
            <ThreadStepChain steps={[{ item: startedItem, running: true }]} />
          ) : null;
      }
    }
    case 'item/completed': {
      const { item } = event.params;
      switch (item.type) {
        case 'agentMessage':
          return item.text.trim() ? <AgentMessageItem text={item.text} /> : null;
        case 'userMessage':
          return null;
        case 'fileChange':
          return renderFileChanges(item.changes);
        case 'enteredReviewMode':
        case 'exitedReviewMode':
          return null;
        case 'plan':
          return <PlanTextItem text={item.text} />;
        default:
          // Steps (thinking, commands, tool calls) render as trace lines; other item
          // types without a renderer stay out of the transcript.
          return isStepItem(item) ? <ThreadStepChain steps={[{ item, running: false }]} /> : null;
      }
    }
    case 'turn/completed': {
      if (event.params.turn.status === 'interrupted') {
        return (
          <div>
            <Badge variant="destructive">{event.params.turn.status}</Badge>
          </div>
        );
      }

      const fileChangeItems = event.params.turn.items.filter(
        (turnItem): turnItem is Extract<typeof turnItem, { type: 'fileChange' }> =>
          turnItem.type === 'fileChange' && turnItem.changes.length > 0
      );

      const aggregatedChanges =
        fileChangeItems.length > 0
          ? aggregateFileChanges(fileChangeItems.flatMap((it) => it.changes))
          : aggregateTurnChangesFromContext(event.params.turn.id, context);

      if (aggregatedChanges.length === 0) return null;

      return (
        <div className="space-y-2">
          <ThreadFileChangesSummary changes={aggregatedChanges} />
        </div>
      );
    }
    case 'turn/plan/updated':
      return <TurnPlan plan={event.params.plan} explanation={event.params.explanation} />;
    case 'item/agentMessage/delta':
      return event.params.delta.trim() ? <AgentMessageItem text={event.params.delta} /> : null;
    case 'item/fileChange/outputDelta':
      return null;
    case 'item/commandExecution/terminalInteraction':
      return (
        <div className="rounded-md border border-slate-300/80 bg-slate-100/40 px-2 py-1 text-xs text-slate-700">
          <span className="mr-2 font-medium">terminal input</span>
          <code className="whitespace-pre-wrap break-all">{event.params.stdin}</code>
        </div>
      );
    case 'thread/started':
    case 'thread/tokenUsage/updated':
    case 'thread/status/changed':
    case 'thread/goal/updated':
    case 'thread/goal/cleared':
    case 'turn/diff/updated':
    case 'rawResponseItem/completed':
    case 'item/commandExecution/outputDelta':
    case 'turn/started':
    case 'mcpServer/startupStatus/updated':
      return null;

    default:
      return null;
  }
};
