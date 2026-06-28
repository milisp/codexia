import { useEffect } from 'react';
import { Composer as CCComposer } from '@/components/cc/composer';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentSwitcher } from './AgentSwitcher';
import { useAgentCenterStore } from '@/stores';
import { Composer as CodexComposer } from '@/components/codex/composer';
import { WorkspaceSwitcher } from '../common';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

export function AgentComposer() {
  const { selectedAgent } = useWorkspaceStore();
  const { currentAgentCardId } = useAgentCenterStore();

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
      </div>

      {/* Input area */}
      <div className={`shrink-0 ${currentAgentCardId && "pb-2"}`}>
        {selectedAgent === 'cc' ? <CCComposer /> : <CodexComposer />}
      </div>
      {!currentAgentCardId && <WorkspaceSwitcher />}
    </div>
  );
}
