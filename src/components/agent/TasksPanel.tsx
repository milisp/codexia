import { useMemo } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { codexService } from '@/services/codexService';
import { gitRemoveWorktree } from '@/services/tauri/git';
import { useAgentCenterStore } from '@/stores';
import { useCCStore } from '@/stores/cc';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentCard } from './AgentCard';

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

export default function TasksPanel() {
  const { cards, removeCard, setCurrentAgentCardId, currentAgentCardId } = useAgentCenterStore();
  const { switchToSession, sessionLoadingMap, activeSessionId, setActiveSessionId } = useCCStore();
  const { threadStatusMap, currentThreadId } = useCodexStore();
  const { setSelectedAgent } = useWorkspaceStore();

  const isRunning = (card: AgentCenterCard) =>
    card.kind === 'codex'
      ? threadStatusMap[card.id]?.type === 'active'
      : !!sessionLoadingMap[card.id];

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
    if (card.worktreePath) {
      const { cwd } = useWorkspaceStore.getState();
      const worktreeKey = card.worktreePath.split('/').pop() ?? '';
      if (cwd && worktreeKey) {
        void gitRemoveWorktree(cwd, worktreeKey);
      }
    }
  };

  const selectCard = (card: AgentCenterCard) => {
    setCurrentAgentCardId(card.id);
    setSelectedAgent(card.kind);
    if (card.kind === 'codex') void codexService.setCurrentThread(card.id);
    else switchToSession(card.id);
  };

  const runningCards = useMemo(
    () => cards.filter((c) => isRunning(c)),
    [cards, threadStatusMap, sessionLoadingMap]
  );

  const idleCards = useMemo(
    () => cards.filter((c) => !isRunning(c)),
    [cards, threadStatusMap, sessionLoadingMap]
  );

  return (
    <div className="flex flex-row h-full w-full min-w-0 overflow-hidden">
      {/* Running section */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-white/10">
        <ColumnLabel dot="green" label="Running" count={runningCards.length} />
        <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
          {runningCards.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 py-4">
              No running agents
            </div>
          ) : (
            runningCards.map((card) => (
              <div key={card.id} onClick={() => selectCard(card)} className="cursor-pointer">
                <AgentCard
                  card={card}
                  onRemove={() => handleRemove(card)}
                  isSelected={card.id === currentAgentCardId}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Idle section */}
      <div className="flex-1 min-w-0 flex flex-col">
        <ColumnLabel dot="muted" label="Idle" count={idleCards.length} />
        <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
          {idleCards.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 py-4">
              No idle agents
            </div>
          ) : (
            idleCards.map((card) => (
              <div key={card.id} onClick={() => selectCard(card)} className="cursor-pointer">
                <AgentCard
                  card={card}
                  onRemove={() => handleRemove(card)}
                  isSelected={card.id === currentAgentCardId}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
