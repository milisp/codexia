import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useCCStore } from '@/stores/cc';
import { ccGetSessionFilePath, ccInterrupt, ccResumeSession } from '@/services/tauri/cc';
import { readTextFileLines } from '@/services/tauri/filesystem';
import { parseSessionJsonl } from '@/components/cc/utils/parseSessionJsonl';
import { Button } from '@/components/ui/button';
import { Check, RotateCcw, Square } from 'lucide-react';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { gitApplyWorktreeChanges, gitRemoveWorktree } from '@/services/tauri/git';
const CCView = lazy(() => import('@/components/cc/CCView'));
import type { ResultMessage } from '@/components/cc/types/messages';
import { toast } from 'sonner';

// ─── helpers ────────────────────────────────────────────────────────────────

export function fmtCost(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  return `$${usd.toFixed(3)}`;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
}

// ─── CCGridCard ──────────────────────────────────────────────────────────────

interface CCGridCardProps {
  card: AgentCenterCard & { kind: 'cc' };
  onRemove: () => void;
  header: React.ReactNode;
  isSelected?: boolean;
}

export function CCGridCard({ card, onRemove: _onRemove, header, isSelected }: CCGridCardProps) {
  const {
    sessionMessagesMap,
    sessionLoadingMap,
    sessionStartTimeMap,
    activeSessionIds,
    addActiveSessionId,
    addMessageToSession,
    setSessionLoading,
    options,
  } = useCCStore();
  const { cwd } = useWorkspaceStore();
  const { setCurrentAgentCardId, updateCard } = useAgentCenterStore();
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [isApplyingWorktree, setIsApplyingWorktree] = useState(false);

  const messages = sessionMessagesMap[card.id] ?? [];
  const isActive = activeSessionIds.includes(card.id);
  // Gate processing on isActive to avoid stale sessionLoadingMap entries.
  const processing = isActive && (sessionLoadingMap[card.id] ?? false);
  const needsResume = !isActive && messages.length === 0;

  const hasPending = messages.some((m) => m.type === 'permission_request' && !m.resolved);
  const canApplyWorktree = !!card.worktreePath && !!cwd && !processing && !hasPending;

  const resultMsg = useMemo<ResultMessage | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'result') return messages[i] as ResultMessage;
    }
    return null;
  }, [messages]);

  const tokens = resultMsg?.usage
    ? ((resultMsg.usage.input_tokens ?? 0) + (resultMsg.usage.output_tokens ?? 0))
    : null;

  const cost: number | null = typeof resultMsg?.total_cost_usd === 'number'
    ? resultMsg.total_cost_usd
    : null;

  // Live elapsed counter — derived from store start time so it survives remounts.
  const startTime = sessionStartTimeMap[card.id] ?? null;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!processing || !startTime) return;
    const update = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [processing, startTime]);

  // Live counter while running; frozen result duration once done.
  const displaySecs: number | null = processing
    ? elapsed
    : resultMsg ? resultMsg.duration_ms / 1000 : null;

  const handleStop = async () => {
    await ccInterrupt(card.id);
  };

  const handleResume = async () => {
    setIsResumingSession(true);
    try {
      const filePath = await ccGetSessionFilePath(card.id);
      if (filePath) {
        const lines = await readTextFileLines(filePath);
        for (const msg of parseSessionJsonl(lines, card.id)) {
          addMessageToSession(card.id, msg);
        }
      }
      await ccResumeSession(card.id, {
        cwd,
        permissionMode: options.permissionMode,
        resume: card.id,
        continueConversation: true,
        ...(options.model ? { model: options.model } : {}),
      });
      addActiveSessionId(card.id);
      setCurrentAgentCardId(card.id);
      setSessionLoading(card.id, false);
    } finally {
      setIsResumingSession(false);
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

  const attentionBorder = hasPending
    ? 'ring-2 ring-amber-500/70 border-amber-500/30'
    : isSelected
      ? 'ring-2 ring-primary/60 border-primary/30'
      : 'border';

  return (
    <div className={`flex flex-col ${attentionBorder} rounded-lg bg-background overflow-hidden h-72 transition-shadow`}>
      {header}

      {/* Message area — CCView owns its own listener and display */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={null}><CCView sessionId={card.id} /></Suspense>
      </div>

      <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          {displaySecs !== null && !isResumingSession && (
            <span className={`text-[10px] font-mono tabular-nums ${processing ? 'text-green-500' : 'text-muted-foreground/60'}`}>
              {fmtElapsed(displaySecs)}
            </span>
          )}
          {tokens !== null && (
            <span className="text-[10px] text-muted-foreground/40">{fmtTokens(tokens)} tok</span>
          )}
          {cost !== null && (
            <span className="text-[10px] text-muted-foreground/40">{fmtCost(cost)}</span>
          )}
          {hasPending && !processing && (
            <span className="text-[10px] text-amber-500">needs input</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {processing && !isResumingSession && (
            <Button size="icon" variant="destructive" className="h-6 w-6" onClick={handleStop}>
              <Square className="h-3 w-3" />
            </Button>
          )}
          {canApplyWorktree && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1"
              disabled={isApplyingWorktree || isResumingSession}
              onClick={(e) => { e.stopPropagation(); void handleApplyWorktree(); }}
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
              disabled={isResumingSession || isApplyingWorktree}
              onClick={(e) => { e.stopPropagation(); void handleResume(); }}
            >
              <RotateCcw className={`h-3 w-3 ${isResumingSession ? 'animate-spin' : ''}`} />
              {isResumingSession ? 'Loading…' : 'Resume'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
