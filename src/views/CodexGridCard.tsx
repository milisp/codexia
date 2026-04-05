import { useRef, useEffect, useState, useMemo } from 'react';
import { useCodexStore } from '@/stores/codex';
import { useApprovalStore, useRequestUserInputStore } from '@/stores/codex';
import { codexService } from '@/services/codexService';
import { gitApplyWorktreeChanges, gitRemoveWorktree, gitStatus, gitStageFiles, gitCommit, gitHasWorktreeChanges } from '@/services/tauri/git';
import { renderEvent } from '@/components/codex/items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, GitCommitHorizontal, RotateCcw, Square } from 'lucide-react';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { ServerNotification } from '@/bindings';
import { toast } from 'sonner';

// ─── helpers ────────────────────────────────────────────────────────────────

export function getFileName(path: string | undefined | null): string {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() ?? path;
}

export function getCodexActiveTurnId(events: ServerNotification[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.method === 'turn/started') return (e.params as { turn: { id: string } }).turn.id;
    if (e.method === 'turn/completed' || e.method === 'error') return null;
  }
  return null;
}

export function getCodexTokens(events: ServerNotification[]): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.method === 'thread/tokenUsage/updated') {
      const total = (e.params as any).tokenUsage?.total?.totalTokens;
      return typeof total === 'number' ? total : null;
    }
  }
  return null;
}

export function getCodexContextWindow(
  events: ServerNotification[]
): { used: number; window: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.method === 'thread/tokenUsage/updated') {
      const tu = (e.params as any).tokenUsage;
      const used = tu?.total?.totalTokens;
      const win = tu?.modelContextWindow;
      if (typeof used === 'number' && typeof win === 'number' && win > 0) {
        return { used, window: win };
      }
      return null;
    }
  }
  return null;
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
}

// ─── ContextWindowBar ────────────────────────────────────────────────────────

export function ContextWindowBar({ used, window: win }: { used: number; window: number }) {
  const pct = Math.min(used / win, 1);
  const color =
    pct > 0.85 ? 'bg-red-500' : pct > 0.65 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="h-0.5 w-full bg-muted/30 shrink-0">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

// ─── CodexGridCard ───────────────────────────────────────────────────────────

interface CodexGridCardProps {
  card: AgentCenterCard & { kind: 'codex' };
  onRemove: () => void;
  header: React.ReactNode;
  isSelected?: boolean;
}

export function CodexGridCard({ card, onRemove: _onRemove, header, isSelected }: CodexGridCardProps) {
  const { events, threadStatusMap, activeThreadIds } = useCodexStore();
  const { pendingApprovals } = useApprovalStore();
  const { pendingRequests } = useRequestUserInputStore();
  const { setCurrentAgentCardId, updateCard } = useAgentCenterStore();
  const { cwd } = useWorkspaceStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [resuming, setResuming] = useState(false);
  const [isApplyingWorktree, setIsApplyingWorktree] = useState(false);
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [worktreeHasChanges, setWorktreeHasChanges] = useState(false);

  const threadEvents = events[card.id] ?? [];
  const processing = threadStatusMap[card.id]?.type === 'active';
  const needsResume = !activeThreadIds.includes(card.id) && threadEvents.length === 0 && !processing;

  const hasPending =
    pendingApprovals.some((a) => (a as any).threadId === card.id) ||
    pendingRequests.some((r) => r.threadId === card.id);

  const tokens = getCodexTokens(threadEvents);
  const ctxWindow = getCodexContextWindow(threadEvents);
  const canApplyWorktree = !!card.worktreePath && !!cwd && !processing && !hasPending && worktreeHasChanges;

  const [elapsed, setElapsed] = useState(0);
  const processingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (processing) {
      if (processingStartRef.current === null) {
        processingStartRef.current = Date.now();
      }
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (processingStartRef.current ?? Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(id);
    } else {
      processingStartRef.current = null;
      setElapsed(0);
    }
  }, [processing]);

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
    const turnId = getCodexActiveTurnId(threadEvents);
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

  const handleCommit = async () => {
    const worktreeKey = card.worktreePath?.split('/').pop();
    if (!cwd || !worktreeKey) return;

    setIsCommitting(true);
    try {
      await gitApplyWorktreeChanges(cwd, worktreeKey);
      const status = await gitStatus(cwd);
      const paths = status.entries.map((e) => e.path);
      if (paths.length > 0) await gitStageFiles(cwd, paths);
      await gitCommit(cwd, commitMsg || card.preview || 'agent changes');
      await gitRemoveWorktree(cwd, worktreeKey);
      updateCard({ ...card, worktreePath: undefined });
      setShowCommitInput(false);
      setCommitMsg('');
      toast.success('Committed worktree changes', {
        description: commitMsg || card.preview || 'agent changes',
      });
    } catch (error) {
      toast.error('Failed to commit', { description: String(error) });
    } finally {
      setIsCommitting(false);
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
    <div className={`flex flex-col ${attentionBorder} rounded-lg bg-background overflow-hidden h-72 transition-shadow`}>
      {header}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]"
      >
        {codexItems.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5 p-3">{codexItems}</div>
        )}
      </div>

      {ctxWindow && <ContextWindowBar used={ctxWindow.used} window={ctxWindow.window} />}

      {showCommitInput && (
        <div
          className="flex items-center gap-1 px-2 py-1 border-t bg-muted/20 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            className="h-6 text-[10px] flex-1 min-w-0 px-1.5"
            placeholder={card.preview?.slice(0, 60) || 'commit message…'}
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCommit();
              if (e.key === 'Escape') { setShowCommitInput(false); setCommitMsg(''); }
            }}
            autoFocus
            disabled={isCommitting}
          />
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-[10px] gap-1 shrink-0"
            disabled={isCommitting}
            onClick={() => void handleCommit()}
          >
            <Check className={`h-3 w-3 ${isCommitting ? 'animate-pulse' : ''}`} />
            {isCommitting ? 'Committing…' : 'OK'}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono tabular-nums ${processing ? 'text-green-500' : 'text-muted-foreground/50'}`}
          >
            {processing && fmtElapsed(elapsed)}
          </span>
          {tokens !== null && (
            <span className="text-[10px] text-muted-foreground/40">{fmtTokens(tokens)} tok</span>
          )}
          {hasPending && !processing && (
            <span className="text-[10px] text-amber-500 animate-pulse">needs input</span>
          )}
          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[80px]" title={card.cwd}>
            {getFileName(card.cwd)}
          </span>
        </div>
        {processing && (
          <Button size="icon" variant="destructive" className="h-6 w-6" onClick={handleStop}>
            <Square className="h-3 w-3" />
          </Button>
        )}
        {canApplyWorktree && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1"
              disabled={isApplyingWorktree || isCommitting}
              onClick={(e) => { e.stopPropagation(); void handleApplyWorktree(); }}
            >
              <Check className={`h-3 w-3 ${isApplyingWorktree ? 'animate-pulse' : ''}`} />
              {isApplyingWorktree ? 'Applying…' : 'Apply'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1"
              disabled={isApplyingWorktree || isCommitting}
              onClick={(e) => { e.stopPropagation(); setShowCommitInput((v) => !v); }}
            >
              <GitCommitHorizontal className="h-3 w-3" />
              Commit
            </Button>
          </div>
        )}
        {needsResume && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1"
            disabled={resuming || isApplyingWorktree || isCommitting}
            onClick={(e) => { e.stopPropagation(); void handleResume(); }}
          >
            <RotateCcw className={`h-3 w-3 ${resuming ? 'animate-spin' : ''}`} />
            {resuming ? 'Loading…' : 'Resume'}
          </Button>
        )}
      </div>
    </div>
  );
}
