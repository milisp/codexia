import { useCallback, useEffect } from 'react';
import { emitTo } from '@tauri-apps/api/event';
import { showMainWindow } from '@/services/tauri/tray';
import { Composer as CCComposer } from '@/components/cc/composer';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentSwitcher } from './AgentSwitcher';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useCCStore } from '@/stores/cc';
import { Composer as CodexComposer, ComposerControls } from '@/components/codex/Composer';
import { TunnelIndicator } from '@/components/features/TunnelIndicator';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

interface AgentComposerProps {
  /** When true, layout is content-driven (no fixed height) so the parent can observe and resize. */
  trayMode?: boolean;
}

export function AgentComposer({ trayMode = false }: AgentComposerProps) {
  const { selectedAgent, setSelectedAgent } = useWorkspaceStore();
  const { currentAgentCardId, cards } = useAgentCenterStore();
  const { setView, setActiveSidebarTab } = useLayoutStore();
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

  const handleTrayOverrideSend = useCallback((text: string) => {
    setActiveSidebarTab(selectedAgent);
    setView('agent');
    emitTo('main', 'tray:pending-send', { kind: selectedAgent, text }).catch(() => { });
    showMainWindow().catch(() => { });
  }, [setView, selectedAgent, setActiveSidebarTab]);

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
            <CCComposer overrideSend={trayMode ? handleTrayOverrideSend : undefined} />
          ) : (
            <CodexComposer showControls={false} overrideSend={trayMode ? handleTrayOverrideSend : undefined} />
          )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0">
          {selectedAgent === 'codex' && <ComposerControls />}
      </div>
    </div>
  );
}
