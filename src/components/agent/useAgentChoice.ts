import { useAcpAgents } from '@/components/acp/useAcpAgents';
import { acpStop } from '@/services/apiAdapt/acp';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export type AgentOption =
  | { kind: 'builtin'; id: 'codex' | 'cc'; name: string; available: true }
  | { kind: 'acp'; id: string; name: string; available: boolean };

export const BUILTIN_AGENTS: AgentOption[] = [
  { kind: 'builtin', id: 'codex', name: 'Codex', available: true },
  { kind: 'builtin', id: 'cc', name: 'Claude Agent', available: true },
];

/**
 * ACP agents can't start without a folder. If none is selected, fall back to
 * the most recently used project (or the last one added).
 */
function ensureProjectForAcp() {
  const { cwd, projects, historyProjects, setCwd } = useWorkspaceStore.getState();
  if (cwd || projects.length === 0) return;
  const added = new Set(projects);
  setCwd(historyProjects.find((path) => added.has(path)) ?? projects[projects.length - 1]);
}

/** Every agent that can drive the chat pane, plus which one does now. */
export function useAgentChoice() {
  const { selectedAgent, setSelectedAgent } = useAgentSettingsStore();
  const { setActiveSidebarTab } = useLayoutStore();
  const { active, agentId, connectionId, setActive, setAgentId, reset } = useAcpStore();
  const acpAgents = useAcpAgents() ?? [];

  const options: AgentOption[] = [
    ...BUILTIN_AGENTS,
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
    ensureProjectForAcp();
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
