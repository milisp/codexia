import { lazy, Suspense } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { useCCStore } from '@/stores/cc';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentCard } from './AgentCard';
import { AgentComposer } from './AgentComposer';
import { AgentViewHeader } from './AgentViewHeader';

const CodexThread = lazy(() =>
  import('@/components/codex/thread/CodexThread').then((m) => ({ default: m.CodexThread }))
);
const CCSession = lazy(() => import('@/components/cc/session/CCSession'));

export default function AgentView() {
  const { selectedAgent } = useWorkspaceStore();
  const { currentThreadId } = useCodexStore();
  const { activeSessionId } = useCCStore();
  const { cards, currentAgentCardId, removeCard, cardsViewMode } = useAgentCenterStore();

  // When no active thread/session, center the composer vertically
  const noActiveSession = selectedAgent === 'codex' ? !currentThreadId : !activeSessionId;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <AgentViewHeader />
      {noActiveSession ? (
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden items-center justify-center">
            <div className="w-full px-2 md:max-w-3xl md:px-0">
              <AgentComposer />
            </div>
          </div>
        </div>
      ) : cards.length > 0 && cardsViewMode !== 'single' ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {cardsViewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {cards.map((card) => (
                  <AgentCard
                    key={`${card.kind}-${card.id}`}
                    card={card}
                    isSelected={currentAgentCardId === card.id}
                    onRemove={() => removeCard(card)}
                  />
                ))}
              </div>
            )}

            {cardsViewMode === 'list' && (
              <div className="flex flex-col gap-1">
                {cards.map((card) => (
                  <AgentCard
                    key={`${card.kind}-${card.id}`}
                    card={card}
                    isSelected={currentAgentCardId === card.id}
                    onRemove={() => removeCard(card)}
                    hideBody
                  />
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 flex justify-center border-t">
            <div className="w-full px-2 md:max-w-3xl md:px-0">
              <AgentComposer />
            </div>
          </div>
        </div>
      ) : cards.length > 0 ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Active card's full session */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Suspense fallback={null}>
              {selectedAgent === 'codex' ? <CodexThread hideComposer /> : <CCSession hideComposer />}
            </Suspense>
          </div>

          <div className="shrink-0 flex justify-center">
            <div className="w-full px-2 md:max-w-3xl md:px-0">
              <AgentComposer />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left: current session */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <Suspense fallback={null}>
                {selectedAgent === 'codex' ? (
                  <CodexThread hideComposer />
                ) : (
                  <CCSession hideComposer />
                )}
              </Suspense>
            </div>
            <div className="shrink-0 flex justify-center">
              <div className="w-full px-2 md:max-w-3xl md:px-0">
                <AgentComposer />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
