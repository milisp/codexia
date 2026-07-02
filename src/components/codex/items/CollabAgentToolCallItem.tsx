import { Bot, Clock, GitBranch, Play, Send, Square } from 'lucide-react';
import type {
  CollabAgentState,
  CollabAgentStatus,
  CollabAgentTool,
  CollabAgentToolCallStatus,
} from '@/bindings/v2';
import { Badge } from '@/components/ui/badge';

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

function toolIcon(tool: CollabAgentTool) {
  switch (tool) {
    case 'spawnAgent':
      return <GitBranch className="h-3.5 w-3.5" />;
    case 'sendInput':
      return <Send className="h-3.5 w-3.5" />;
    case 'resumeAgent':
      return <Play className="h-3.5 w-3.5" />;
    case 'wait':
      return <Clock className="h-3.5 w-3.5" />;
    case 'closeAgent':
      return <Square className="h-3.5 w-3.5" />;
    default:
      return <Bot className="h-3.5 w-3.5" />;
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

  const callStatusClass =
    status === 'completed'
      ? 'border-green-500/30 bg-green-500/5'
      : status === 'failed'
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-blue-500/30 bg-blue-500/5';

  const agentEntries = Object.entries(agentsStates ?? {});

  return (
    <div className={`rounded-md border px-3 py-2.5 text-xs space-y-2 ${callStatusClass}`}>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-muted-foreground">
          {toolIcon(tool)}
          <span className="font-medium text-foreground">{toolLabel(tool, status)}</span>
        </span>

        {/* Receiver thread IDs */}
        {receiverThreadIds.length > 0 && (
          <span className="text-muted-foreground">
            {receiverThreadIds.map((id) => (
              <code key={id} className="font-mono text-[10px] bg-muted rounded px-1 py-0.5 mr-1">
                {shortId(id)}
              </code>
            ))}
          </span>
        )}

        {/* Overall call status badge */}
        <Badge
          variant="outline"
          className={`ml-auto text-[10px] px-1.5 py-0 ${
            status === 'completed'
              ? 'border-green-500/40 text-green-700 dark:text-green-400'
              : status === 'failed'
                ? 'border-red-500/40 text-red-700 dark:text-red-400'
                : 'border-blue-500/40 text-blue-700 dark:text-blue-400'
          }`}
        >
          {status}
        </Badge>
      </div>

      {/* Prompt snippet — first 120 chars */}
      {prompt && (
        <p className="text-muted-foreground italic line-clamp-2 leading-relaxed">
          {prompt.length > 120 ? `${prompt.slice(0, 120)}…` : prompt}
        </p>
      )}

      {/* Per-agent state rows */}
      {agentEntries.length > 0 && (
        <div className="space-y-1 pt-0.5">
          {agentEntries.map(([threadId, agentState]) => {
            const { label, className } = agentStatusDisplay(agentState.status);
            return (
              <div key={threadId} className="flex items-center gap-2">
                <Bot className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <code className="font-mono text-[10px] text-muted-foreground">
                  {shortId(threadId)}
                </code>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
                  {label}
                </span>
                {agentState.message && (
                  <span className="text-muted-foreground truncate">{agentState.message}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
