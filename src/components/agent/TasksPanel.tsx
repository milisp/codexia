import { Check, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CCMessage, PermissionRequestMessage } from '@/components/cc/types/messages';
import {
  useApprovalStore,
  useCodexStore,
  useRequestUserInputStore,
} from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ccInterrupt } from '@/services/apiAdapt/cc';
import {
  gitApplyWorktreeChanges,
  gitHasWorktreeChanges,
  gitRemoveWorktree,
} from '@/services/apiAdapt/git';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore } from '@/stores';
import { useCCStore } from '@/stores/cc';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';
import { AgentLogo } from './AgentLogo';
import { getCodexActiveTurnId } from './utils';

function ColumnLabel({
  dot,
  label,
  count,
}: {
  dot?: 'green' | 'muted';
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b shrink-0 bg-muted/20">
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot === 'green' ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
        />
      )}
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground/50 ml-auto">{count}</span>
    </div>
  );
}

const worktreeKeyOf = (card: AgentCenterCard) => card.worktreePath?.split('/').pop() ?? '';

interface TaskRowProps {
  card: AgentCenterCard;
  running: boolean;
  pending: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

/** One compact Kanban entry: status, agent, title, and the actions that need no transcript. */
function TaskRow({ card, running, pending, isSelected, onSelect, onRemove }: TaskRowProps) {
  const cwd = useWorkspaceStore((s) => s.cwd);
  const turnTiming = useCodexStore((s) => s.turnTimingMap[card.id]);
  const updateCard = useAgentCenterStore((s) => s.updateCard);
  const [hasWorktreeChanges, setHasWorktreeChanges] = useState(false);
  const [applying, setApplying] = useState(false);
  const worktreeKey = worktreeKeyOf(card);

  useEffect(() => {
    if (!cwd || !worktreeKey) {
      setHasWorktreeChanges(false);
      return;
    }
    let cancelled = false;
    gitHasWorktreeChanges(cwd, worktreeKey)
      .then((result) => !cancelled && setHasWorktreeChanges(result.has_changes))
      .catch(() => !cancelled && setHasWorktreeChanges(false));
    return () => {
      cancelled = true;
    };
  }, [cwd, worktreeKey]);

  const handleStop = async () => {
    if (card.kind === 'cc') {
      await ccInterrupt(card.id);
      return;
    }
    const turnId = getCodexActiveTurnId(turnTiming);
    if (turnId) await codexService.turnInterrupt(card.id, turnId);
  };

  const handleApplyWorktree = async () => {
    if (!cwd || !worktreeKey) return;
    setApplying(true);
    try {
      const result = await gitApplyWorktreeChanges(cwd, worktreeKey);
      await gitRemoveWorktree(cwd, worktreeKey);
      updateCard({ ...card, worktreePath: undefined });
      toast.success('Applied worktree changes', {
        description: `${result.changed_files} file${result.changed_files === 1 ? '' : 's'} merged into the main checkout`,
      });
    } catch (error) {
      toast.error('Failed to apply worktree changes', { description: String(error) });
    } finally {
      setApplying(false);
    }
  };

  const title = card.preview?.slice(0, 80) || card.id.slice(0, 12);
  const dotColor = running
    ? 'bg-green-500 animate-pulse'
    : pending
      ? 'bg-amber-500 animate-pulse'
      : 'bg-muted-foreground/40';
  const canApply = hasWorktreeChanges && !running && !pending;

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md border bg-background pr-1 transition-colors hover:bg-accent/40',
        pending ? 'border-amber-500/40' : isSelected ? 'border-primary/40 bg-accent/30' : ''
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
        title={card.cwd ?? undefined}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
        <AgentLogo id={card.kind} className="h-3.5 w-3.5" />
        <span className="min-w-0 flex-1 truncate text-xs">{title}</span>
        {pending && <span className="shrink-0 text-[10px] text-amber-500">needs input</span>}
        {card.cwd && (
          <span className="max-w-[80px] shrink-0 truncate text-[10px] text-muted-foreground/60">
            {getFilename(card.cwd)}
          </span>
        )}
      </button>
      {running && (
        <Button
          size="icon-xs"
          variant="ghost"
          title="Stop"
          aria-label="Stop"
          onClick={() => void handleStop()}
        >
          <Square className="text-destructive" />
        </Button>
      )}
      {canApply && (
        <Button
          size="xs"
          variant="outline"
          disabled={applying}
          onClick={() => void handleApplyWorktree()}
        >
          <Check className={applying ? 'animate-pulse' : ''} />
          {applying ? 'Applying…' : 'Apply'}
        </Button>
      )}
      <Button
        size="icon-xs"
        variant="ghost"
        title="Remove"
        aria-label="Remove"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

export default function TasksPanel() {
  const { cards, removeCard, setCurrentAgentCardId, currentAgentCardId } = useAgentCenterStore();
  const {
    switchToSession,
    sessionLoadingMap,
    sessionMessagesMap,
    activeSessionIds,
    activeSessionId,
    setActiveSessionId,
  } = useCCStore();
  const { threadStatusMap, currentThreadId } = useCodexStore();
  const { pendingApprovals } = useApprovalStore();
  const { pendingRequests } = useRequestUserInputStore();
  const { setSelectedAgent } = useAgentSettingsStore();

  const isRunning = useCallback(
    (card: AgentCenterCard) =>
      card.kind === 'codex'
        ? threadStatusMap[card.id]?.type === 'active'
        : !!sessionLoadingMap[card.id],
    [threadStatusMap, sessionLoadingMap]
  );

  // Waiting on the user: a codex turn blocked on flags, an unresolved CC
  // permission request, or a pending approval / input request.
  const isPending = useCallback(
    (card: AgentCenterCard) => {
      if (card.kind === 'codex') {
        const status = threadStatusMap[card.id];
        if (status?.type === 'active' && status.activeFlags.length > 0) return true;
      } else if (
        (sessionMessagesMap[card.id] ?? []).some(
          (m: CCMessage): m is PermissionRequestMessage =>
            m.type === 'permission_request' && !m.resolved
        )
      ) {
        return true;
      }
      return (
        pendingApprovals.some((a) => a.threadId === card.id) ||
        pendingRequests.some((r) => r.threadId === card.id)
      );
    },
    [threadStatusMap, sessionMessagesMap, pendingApprovals, pendingRequests]
  );

  const handleRemove = (card: AgentCenterCard) => {
    removeCard(card);
    if (card.id === currentAgentCardId) {
      setCurrentAgentCardId(null);
    }
    if (card.kind === 'codex') {
      if (card.id === currentThreadId) {
        void codexService.setCurrentThread(null);
      }
    } else {
      if (card.id === activeSessionId) {
        setActiveSessionId(null);
      }
    }
    const worktreeKey = worktreeKeyOf(card);
    if (worktreeKey) {
      const { cwd } = useWorkspaceStore.getState();
      if (cwd) void gitRemoveWorktree(cwd, worktreeKey);
    }
  };

  const selectCard = (card: AgentCenterCard) => {
    setCurrentAgentCardId(card.id);
    setSelectedAgent(card.kind);
    if (card.kind === 'codex') void codexService.setCurrentThread(card.id);
    else switchToSession(card.id);
  };

  const runningCards = useMemo(() => cards.filter((c) => isRunning(c)), [cards, isRunning]);

  const idleCards = useMemo(() => cards.filter((c) => !isRunning(c)), [cards, isRunning]);

  const renderRow = (card: AgentCenterCard) => {
    const pending = isPending(card);
    // A CC session only counts as running while it is live; a codex turn
    // blocked on the user shows as pending instead.
    const running =
      card.kind === 'codex'
        ? isRunning(card) && !pending
        : activeSessionIds.includes(card.id) && isRunning(card);
    return (
      <TaskRow
        key={`${card.kind}-${card.id}`}
        card={card}
        running={running}
        pending={pending}
        isSelected={card.id === currentAgentCardId}
        onSelect={() => selectCard(card)}
        onRemove={() => handleRemove(card)}
      />
    );
  };

  return (
    <div className="flex flex-row h-full w-full min-w-0 overflow-hidden">
      {/* Running section */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-white/10">
        <ColumnLabel dot="green" label="Running" count={runningCards.length} />
        <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
          {runningCards.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 py-4">
              No running agents
            </div>
          ) : (
            runningCards.map(renderRow)
          )}
        </div>
      </div>

      {/* Idle section */}
      <div className="flex-1 min-w-0 flex flex-col">
        <ColumnLabel dot="muted" label="Idle" count={idleCards.length} />
        <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
          {idleCards.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 py-4">
              No idle agents
            </div>
          ) : (
            idleCards.map(renderRow)
          )}
        </div>
      </div>
    </div>
  );
}
