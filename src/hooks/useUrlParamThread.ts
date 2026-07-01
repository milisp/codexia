import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { navigateToAgentSession } from '@/lib/agentNav';

let processed = false;

// Reads ?agent=codex&thread=<id>&cwd=<path> or ?agent=cc&session=<id>&cwd=<path>
// from the page URL on first mount and navigates to that agent session.
// Used by external launchers (e.g. rejoin) to deep-link into a specific
// session in web mode.
export function useUrlParamThread(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || processed) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const agent = params.get('agent');
    const cwd = params.get('cwd');
    const threadId = params.get('thread');
    const sessionId = params.get('session');
    const projectsToAdd = params.getAll('addProject').filter(Boolean);
    const hasAgentNav = !!agent && !!cwd && (agent === 'codex' || agent === 'cc');
    if (!hasAgentNav && projectsToAdd.length === 0) return;

    processed = true;

    const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    const { addProject } = useWorkspaceStore.getState();
    for (const p of projectsToAdd) addProject(p);

    if (!hasAgentNav) return;

    navigateToAgentSession({ agent, cwd, threadId, sessionId });
  }, [enabled]);
}
