import { codexService } from '@/services/codexService';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export interface AgentNavParams {
  agent: string | null;
  cwd: string | null;
  threadId?: string | null;
  sessionId?: string | null;
}

// Shared navigation logic used by both web-mode URL params (useUrlParamThread)
// and OS-level deep links (useAppDeepLink). Dispatches the same store updates
// that a sidebar row click does, opening the given agent session.
export function navigateToAgentSession({
  agent,
  cwd,
  threadId,
  sessionId,
}: AgentNavParams): boolean {
  if (!agent || !cwd || (agent !== 'codex' && agent !== 'cc')) return false;

  const { addProject, setCwd, setSelectedAgent } = useWorkspaceStore.getState();
  const { setView, setActiveSidebarTab } = useLayoutStore.getState();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore.getState();

  addProject(cwd);
  setCwd(cwd);

  if (agent === 'codex' && threadId) {
    setSelectedAgent('codex');
    setActiveSidebarTab('codex');
    addAgentCard({ kind: 'codex', id: threadId, cwd });
    setCurrentAgentCardId(threadId);
    setView('agent');
    void codexService.setCurrentThread(threadId);
    return true;
  }

  if (agent === 'cc' && sessionId) {
    setSelectedAgent('cc');
    setActiveSidebarTab('cc');
    addAgentCard({ kind: 'cc', id: sessionId, cwd });
    setCurrentAgentCardId(sessionId);
    setView('agent');
    return true;
  }

  return false;
}
