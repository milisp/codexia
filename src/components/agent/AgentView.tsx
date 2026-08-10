import { lazy, Suspense } from 'react';
import { CodexAuth } from '@/components/codex/CodexAuth';
import { useCodexStore, useConfigStore } from '@/components/codex/stores';
import { useCCStore } from '@/stores/cc';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { AgentCard } from './AgentCard';
import { AgentComposer } from './AgentComposer';
import { AgentViewHeader } from './AgentViewHeader';
import { PluxPromo } from './PluxPromo';

const CodexThread = lazy(() =>
  import('@/components/codex/thread/CodexThread').then((m) => ({ default: m.CodexThread }))
);
const CCSession = lazy(() => import('@/components/cc/session/CCSession'));
const AcpSession = lazy(() => import('@/components/acp/AcpSession'));

/** Renders the transcript for whichever agent drives the chat pane. */
function AgentSession() {
  const { selectedAgent } = useAgentSettingsStore();
  const acpActive = useAcpStore((s) => s.active);
  if (acpActive) return <AcpSession />;
  if (selectedAgent === 'cc') return <CCSession />;
  return <CodexThread />;
}

export default function AgentView() {
  const { selectedAgent } = useAgentSettingsStore();
  const { currentThreadId, hasAccount } = useCodexStore();
  const { modelProvider } = useConfigStore();
  const { activeSessionId } = useCCStore();
  const { active: acpActive, connectionId: acpConnectionId } = useAcpStore();
  const { cards, currentAgentCardId, removeCard, cardsViewMode } = useAgentCenterStore();

  // When no active thread/session, center the composer vertically
  const noActiveSession = acpActive
    ? !acpConnectionId
    : selectedAgent === 'codex'
      ? !currentThreadId
      : !activeSessionId;
  const showCodexAuth = !acpActive && selectedAgent === 'codex' && hasAccount === false;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <AgentViewHeader />
      {cards.length > 0 && cardsViewMode !== 'solo' ? (
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
            <div className="flex flex-col gap-4 w-full px-4 md:max-w-3xl md:px-0">
              {showCodexAuth && modelProvider === 'openai' && <CodexAuth />}
              <AgentComposer />
              <PluxPromo />
            </div>
          </div>
        </div>
      ) : cards.length > 0 ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Active card's full session */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Suspense fallback={null}>
              <AgentSession />
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
                <AgentSession />
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
