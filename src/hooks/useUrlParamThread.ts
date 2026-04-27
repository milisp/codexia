import { useEffect } from 'react';
import { codexService } from '@/services/codexService';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
import { useCCStore } from '@/stores/cc';
import { ccGetSessionFilePath } from '@/services/tauri/cc';
import { readTextFileLines } from '@/services/tauri/filesystem';
import { parseSessionJsonl } from '@/components/cc/utils/parseSessionJsonl';
import { isGitRepo } from '@/services/tauri/git';

let processed = false;

// Reads ?agent=codex&thread=<id>&cwd=<path> or ?agent=cc&session=<id>&cwd=<path>
// from the page URL on first mount and dispatches the same store updates that
// a sidebar row click does. Used by external launchers (e.g. rejoin) to deep-link
// into a specific session in web mode.
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

    const { addProject, setCwd, setSelectedAgent } = useWorkspaceStore.getState();
    const { setView, setActiveSidebarTab } = useLayoutStore.getState();
    const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore.getState();

    for (const p of projectsToAdd) addProject(p);

    if (!hasAgentNav) return;

    void (async () => {
      // Only switch cwd if the target is a git repo. Otherwise codexia's
      // git pollers (useGitWatch consumers) loop on errors. Sessions can
      // still open into the user's current project context.
      if (await isGitRepo(cwd!)) {
        addProject(cwd!);
        setCwd(cwd!);
      } else {
        console.warn(`[useUrlParamThread] cwd '${cwd}' isn't a git repo — keeping current cwd.`);
      }

      if (agent === 'codex' && threadId) {
        setSelectedAgent('codex');
        setActiveSidebarTab('codex');
        addAgentCard({ kind: 'codex', id: threadId, cwd });
        setCurrentAgentCardId(threadId);
        setView('agent');
        void codexService.setCurrentThread(threadId, { resume: true });
      } else if (agent === 'cc' && sessionId) {
        setSelectedAgent('cc');
        setActiveSidebarTab('cc');
        addAgentCard({ kind: 'cc', id: sessionId, cwd });
        setCurrentAgentCardId(sessionId);
        setView('agent');
        const { sessionMessagesMap, addMessageToSession, setSessionLoading } = useCCStore.getState();
        if (!sessionMessagesMap[sessionId]?.length) {
          const filePath = await ccGetSessionFilePath(sessionId);
          if (!filePath) return;
          const lines = await readTextFileLines(filePath);
          for (const msg of parseSessionJsonl(lines, sessionId)) {
            addMessageToSession(sessionId, msg);
          }
          setSessionLoading(sessionId, false);
        }
      }
    })();
  }, [enabled]);
}
