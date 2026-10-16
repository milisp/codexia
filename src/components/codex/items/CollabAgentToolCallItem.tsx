import { Bot } from 'lucide-react';
import type {
  CollabAgentState,
  CollabAgentStatus,
  CollabAgentTool,
  CollabAgentToolCallStatus,
} from '@/bindings/v2';
import { Subagent } from '@/components/ai-elements/Subagent';
import { TraceIcon, TraceLine, TraceTitle } from '@/components/ui/trace';

// Shape of the collabAgentToolCall item from item/completed.
export interface CollabAgentToolCallItemData {
  type: 'collabAgentToolCall';
  id: string;
  tool: CollabAgentTool;
  status: CollabAgentToolCallStatus;
  senderThreadId: string;
  receiverThreadIds: string[];
  prompt: string | null;
  model: string | null;
  reasoningEffort: string | null;
  agentsStates: Record<string, CollabAgentState>;
}

// Human-readable label for each collab tool operation.
function toolLabel(tool: CollabAgentTool, status: CollabAgentToolCallStatus): string {
  const done = status === 'completed';
  switch (tool) {
    case 'spawnAgent':
      return done ? 'Spawned sub-agent' : 'Spawning sub-agent';
    case 'sendInput':
      return done ? 'Sent to sub-agent' : 'Sending to sub-agent';
    case 'resumeAgent':
      return done ? 'Resumed sub-agent' : 'Resuming sub-agent';
    case 'wait':
      return done ? 'Waited for sub-agent' : 'Waiting for sub-agent';
    case 'closeAgent':
      return done ? 'Closed sub-agent' : 'Closing sub-agent';
    default:
      return 'Sub-agent operation';
  }
}

// Map agent-level status to a badge variant + label.
function agentStatusDisplay(status: CollabAgentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'running':
      return { label: 'running', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' };
    case 'completed':
      return { label: 'done', className: 'bg-green-500/15 text-green-700 dark:text-green-400' };
    case 'errored':
      return { label: 'errored', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
    case 'interrupted':
      return {
        label: 'stopped',
        className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
      };
    case 'shutdown':
      return { label: 'shutdown', className: 'bg-muted text-muted-foreground' };
    case 'pendingInit':
      return { label: 'starting', className: 'bg-muted text-muted-foreground' };
    case 'notFound':
      return { label: 'not found', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
    default:
      return { label: status, className: 'bg-muted text-muted-foreground' };
  }
}

// Shorten a full thread UUID to the last 8 chars for display.
function shortId(threadId: string): string {
  return threadId.length > 8 ? `…${threadId.slice(-8)}` : threadId;
}

interface CollabAgentToolCallItemProps {
  item: CollabAgentToolCallItemData;
}

export function CollabAgentToolCallItem({ item }: CollabAgentToolCallItemProps) {
  const { tool, status, receiverThreadIds, prompt, agentsStates } = item;
  const agentEntries = Object.entries(agentsStates ?? {});
  const state = status === 'completed' ? 'done' : status === 'failed' ? 'error' : 'running';
  const hasDetails = !!prompt || agentEntries.length > 0;

  return (
    <Subagent
      title={toolLabel(tool, status)}
      description={receiverThreadIds.map(shortId).join(' ') || undefined}
      state={state}
    >
      {hasDetails ? (
        <>
          {prompt && (
            <p className="italic line-clamp-3">
              {prompt.length > 240 ? `${prompt.slice(0, 240)}…` : prompt}
            </p>
          )}
          {agentEntries.map(([threadId, agentState]) => {
            const { label, className } = agentStatusDisplay(agentState.status);
            return (
              <TraceLine key={threadId}>
                <TraceIcon>
                  <Bot />
                </TraceIcon>
                <code className="font-mono text-xs">{shortId(threadId)}</code>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>
                  {label}
                </span>
                {agentState.message && <TraceTitle>{agentState.message}</TraceTitle>}
              </TraceLine>
            );
          })}
        </>
      ) : null}
    </Subagent>
  );
}
