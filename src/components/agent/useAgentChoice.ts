import { useAcpAgents } from '@/components/acp/useAcpAgents';
import { acpStop } from '@/services/apiAdapt/acp';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';

export type AgentOption =
  | { kind: 'builtin'; id: 'codex' | 'cc'; name: string; available: true }
  | { kind: 'acp'; id: string; name: string; available: boolean };

const BUILTIN: AgentOption[] = [
  { kind: 'builtin', id: 'codex', name: 'Codex', available: true },
  { kind: 'builtin', id: 'cc', name: 'Claude Agent', available: true },
];

/** Every agent that can drive the chat pane, plus which one does now. */
export function useAgentChoice() {
  const { selectedAgent, setSelectedAgent } = useAgentSettingsStore();
  const { setActiveSidebarTab } = useLayoutStore();
  const { active, agentId, connectionId, setActive, setAgentId, reset } = useAcpStore();
  const acpAgents = useAcpAgents() ?? [];

  const options: AgentOption[] = [
    ...BUILTIN,
    ...acpAgents.map((a) => ({
      kind: 'acp' as const,
      id: a.id,
      name: a.name,
      available: a.available,
    })),
  ];

  const isCurrent = (option: AgentOption) =>
    option.kind === 'acp'
      ? active && agentId === option.id
      : !active && selectedAgent === option.id;

  const current = options.find(isCurrent);

  const select = async (option: AgentOption) => {
    if (option.kind === 'builtin') {
      setSelectedAgent(option.id);
      setActiveSidebarTab(option.id);
      // Leave the ACP connection running so switching back keeps the transcript.
      setActive(false);
      return;
    }
    if (active && agentId === option.id) return;
    if (connectionId && agentId !== option.id) {
      await acpStop(connectionId);
      reset();
    }
    setAgentId(option.id);
    setActive(true);
  };

  return { options, current, isCurrent, select };
}
