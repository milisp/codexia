import { useEffect } from 'react';
import { Composer as CCComposer } from '@/components/cc/composer';
import { AcpComposer } from '@/components/acp/AcpComposer';
import { Composer as CodexComposer } from '@/components/codex/composer';
import { useAgentCenterStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { WorkspaceSwitcher } from '../common';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

export function AgentComposer() {
  const { selectedAgent } = useAgentSettingsStore();
  const acpActive = useAcpStore((s) => s.active);
  const { currentAgentCardId } = useAgentCenterStore();

  // Auto-focus the CC composer input when switching to the cc agent
  useEffect(() => {
    if (selectedAgent === 'cc') {
      focusCCInput();
    }
  }, [selectedAgent]);

  return (
    <div className="flex flex-col">
      {/* Input area */}
      <div className={`shrink-0 ${currentAgentCardId && 'pb-2'}`}>
        {acpActive ? <AcpComposer /> : selectedAgent === 'cc' ? <CCComposer /> : <CodexComposer />}
      </div>
      {!currentAgentCardId && <WorkspaceSwitcher />}
    </div>
  );
}
