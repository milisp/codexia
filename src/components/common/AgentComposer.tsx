import { useEffect } from 'react';
import { Composer as CCComposer } from '@/components/cc/composer';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentSwitcher } from './AgentSwitcher';
import { useAgentCenterStore } from '@/stores';
import { useCCStore } from '@/stores/cc';
import { Composer as CodexComposer, ComposerControls } from '@/components/codex/Composer';
import { TunnelIndicator } from '@/components/features/TunnelIndicator';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

export function AgentComposer() {
  const { selectedAgent, setSelectedAgent } = useWorkspaceStore();
  const { currentAgentCardId, cards } = useAgentCenterStore();
  const { switchToSession } = useCCStore();

  // Sync tab and active session to the currently selected card
  useEffect(() => {
    if (!currentAgentCardId) return;
    const card = cards.find((c) => c.id === currentAgentCardId);
    if (!card) return;
    setSelectedAgent(card.kind);
    if (card.kind === 'cc') {
      switchToSession(card.id);
    }
  }, [currentAgentCardId]);

  // Auto-focus the CC composer input when switching to the cc agent
  useEffect(() => {
    if (selectedAgent === 'cc') {
      focusCCInput();
    }
  }, [selectedAgent]);

  return (
    <div className="flex flex-col">
      {/* Agent tabs */}
      <div className="flex items-center justify-between gap-2 shrink-0">
          <AgentSwitcher variant="tab" />
          <TunnelIndicator variant="switch" />
      </div>

      {/* Input area */}
      <div className="shrink-0">
          {selectedAgent === 'cc' ? (
            <CCComposer />
          ) : (
            <CodexComposer showControls={false} />
          )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0">
          {selectedAgent === 'codex' && <ComposerControls />}
      </div>
    </div>
  );
}
