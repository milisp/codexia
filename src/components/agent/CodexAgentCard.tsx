import { Check, RotateCcw, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { renderEvent } from '@/components/codex/items';
import {
  useApprovalStore,
  useCodexStore,
  useRequestUserInputStore,
} from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import { codexService } from '@/services/codexService';
import {
  gitApplyWorktreeChanges,
  gitHasWorktreeChanges,
  gitRemoveWorktree,
} from '@/services/tauri/git';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';
import {
  fmtElapsed,
  fmtTokens,
  getCodexActiveTurnId,
  getCodexContextWindow,
  getCodexTokens,
} from './utils';

// ─── ContextWindowBar ────────────────────────────────────────────────────────

interface ContextWindowBarProps {
  used: number;
  window: number;
}

export function ContextWindowBar({ used, window }: ContextWindowBarProps) {
  const pct = Math.min(used / window, 1);
  const color = pct > 0.85 ? 'bg-red-500' : pct > 0.65 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="h-0.5 w-full bg-muted/30 shrink-0">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

// ─── CodexAgentCard ────────────────────────────────────────────────────────

interface CodexAgentCardProps {
  card: AgentCenterCard & { kind: 'codex' };
  onRemove: () => void;
  header: React.ReactNode;
  isSelected?: boolean;
}

export function CodexAgentCard({
  card,
  onRemove: _onRemove,
  header,
  isSelected,
}: CodexAgentCardProps) {
  const { events, threadStatusMap, turnTimingMap, activeThreadIds } = useCodexStore();
  const { pendingApprovals } = useApprovalStore();
  const { pendingRequests } = useRequestUserInputStore();
  const { setCurrentAgentCardId, updateCard } = useAgentCenterStore();
  const { cwd } = useWorkspaceStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [resuming, setResuming] = useState(false);
  const [isApplyingWorktree, setIsApplyingWorktree] = useState(false);
  const [worktreeHasChanges, setWorktreeHasChanges] = useState(false);

  const threadEvents = events[card.id] ?? [];
  const processing = threadStatusMap[card.id]?.type === 'active';
  const needsResume =
    !activeThreadIds.includes(card.id) && threadEvents.length === 0 && !processing;

  const hasPending =
    pendingApprovals.some((a: any) => a.threadId === card.id) ||
    pendingRequests.some((r: any) => r.threadId === card.id);

  const tokens = getCodexTokens(threadEvents);
  const ctxWindow = getCodexContextWindow(threadEvents);
  const canApplyWorktree =
    !!card.worktreePath && !!cwd && !processing && !hasPending && worktreeHasChanges;

  // turnTimingMap is the single source of truth for turn timing (see TurnTiming
  // in useCodexStore) — driven directly by turn/started + turn/completed + error,
  // so it stays correct even when a turn ends via error/interrupt, unlike scanning
  // raw events which could disagree with threadStatusMap's active/idle flip.
  const turnTiming = turnTimingMap[card.id];
  const turnInProgress = turnTiming?.status === 'inProgress';
  // `tick` only forces a re-render every 200ms; elapsed time itself is
  // derived from turnTiming.startedAtMs, not synced into state.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!turnInProgress) return;

    const intervalId = setInterval(() => {
      setTick((t) => t + 1);
    }, 200);

    return () => clearInterval(intervalId);
  }, [turnInProgress]);

  const elapsed = turnInProgress && turnTiming ? Date.now() - turnTiming.startedAtMs : 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [threadEvents.length]);

  useEffect(() => {
    const checkWorktreeChanges = async () => {
      if (!card.worktreePath || !cwd) {
        setWorktreeHasChanges(false);
        return;
      }
      try {
        const worktreeKey = card.worktreePath.split('/').pop();
        if (!worktreeKey) {
          setWorktreeHasChanges(false);
          return;
        }
        const result = await gitHasWorktreeChanges(cwd, worktreeKey);
        setWorktreeHasChanges(result.has_changes);
      } catch (error) {
        setWorktreeHasChanges(false);
      }
    };

    checkWorktreeChanges();
  }, [card.worktreePath, cwd]);

  const handleStop = async () => {
    const turnId = getCodexActiveTurnId(turnTiming);
    if (turnId) await codexService.turnInterrupt(card.id, turnId);
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await codexService.threadResume(card.id);
      setCurrentAgentCardId(card.id);
    } finally {
      setResuming(false);
    }
  };

  const handleApplyWorktree = async () => {
    const worktreeKey = card.worktreePath?.split('/').pop();
    if (!cwd || !worktreeKey) return;

    setIsApplyingWorktree(true);
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
      setIsApplyingWorktree(false);
    }
  };

  const codexItems = useMemo(
    () =>
      threadEvents
        .map((event, i) => {
          const rendered = renderEvent(event, { events: threadEvents, eventIndex: i });
          return rendered ? <div key={i}>{rendered}</div> : null;
        })
        .filter(Boolean),
    [threadEvents]
  );

  const attentionBorder = hasPending
    ? 'ring-2 ring-amber-500/70 border-amber-500/30'
    : isSelected
      ? 'ring-2 ring-primary/60 border-primary/30'
      : 'border';

  return (
    <div
      className={`flex flex-col ${attentionBorder} rounded-lg bg-background overflow-hidden h-72 transition-shadow`}
    >
      {header}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]">
        {codexItems.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5 p-3">{codexItems}</div>
        )}
      </div>

      {ctxWindow && <ContextWindowBar used={ctxWindow.used} window={ctxWindow.window} />}

      <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono tabular-nums ${turnInProgress ? 'text-green-500' : 'text-muted-foreground/50'}`}
          >
            {turnInProgress && fmtElapsed(elapsed)}
          </span>
          {tokens !== null && (
            <span className="text-[10px] text-muted-foreground/40">{fmtTokens(tokens)} tok</span>
          )}
          {hasPending && !processing && (
            <span className="text-[10px] text-amber-500 animate-pulse">needs input</span>
          )}
          <span
            className="text-[10px] text-muted-foreground/60 truncate max-w-[80px]"
            title={card.cwd ?? ''}
          >
            {getFilename(card.cwd)}
          </span>
        </div>
        {processing && (
          <Button size="icon" variant="destructive" className="h-6 w-6" onClick={handleStop}>
            <Square className="h-3 w-3" />
          </Button>
        )}
        {canApplyWorktree && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1"
            disabled={isApplyingWorktree}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              void handleApplyWorktree();
            }}
          >
            <Check className={`h-3 w-3 ${isApplyingWorktree ? 'animate-pulse' : ''}`} />
            {isApplyingWorktree ? 'Applying…' : 'Apply'}
          </Button>
        )}
        {needsResume && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1"
            disabled={resuming || isApplyingWorktree}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              void handleResume();
            }}
          >
            <RotateCcw className={`h-3 w-3 ${resuming ? 'animate-spin' : ''}`} />
            {resuming ? 'Loading…' : 'Resume'}
          </Button>
        )}
      </div>
    </div>
  );
}
