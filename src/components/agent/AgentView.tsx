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
      {cards.length > 0 && cardsViewMode !== 'single' ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {cardsViewMode === 'grid' && (
              // flex-wrap (not CSS grid) so each card's manually-resized width/height
              // (see useCardResize) can take effect independently, Ghostty-pane style.
              // Cards without a saved width fall back to flex-basis so they still tile
              // responsively like the old grid.
              <div className="flex flex-wrap gap-2 items-start">
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
                    hideBody={currentAgentCardId !== card.id}
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
      ) : noActiveSession ? (
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden items-center justify-center">
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
              {selectedAgent === 'codex' ? <CodexThread /> : <CCSession />}
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
                  <CodexThread />
                ) : (
                  <CCSession />
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
