// Handles opening a session: agent card setup, view switch, and message loading.
import { useCallback } from 'react';
import { fromSdkMessages } from '@/components/cc/utils/fromSdkMessages';
import type { SdkSessionInfo } from '@/lib/sessions';
import { ccGetSessionMessages } from '@/services/tauri/cc';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useCCStore } from '@/stores/cc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

interface UseSessionSelectionArgs {
  directory: string;
  onSelectSession?: (sessionId: string, project?: string) => void;
}

export function useSessionSelection({ directory, onSelectSession }: UseSessionSelectionArgs) {
  const { setCwd, setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const {
    activeSessionIds,
    activeSessionId,
    isLoading,
    addMessageToSession,
    setSessionLoading,
    sessionMessagesMap,
  } = useCCStore();

  const handleSessionClick = useCallback(
    (session: SdkSessionInfo) => {
      const sessionProject = session.cwd ?? '';
      if (sessionProject && sessionProject !== directory) {
        setCwd(sessionProject);
      }
      setSelectedAgent('cc');
      addAgentCard({
        kind: 'cc',
        id: session.session_id,
        preview: session.summary,
        cwd: sessionProject || directory,
      });
      setCurrentAgentCardId(session.session_id);
      setView('agent');
      if (onSelectSession) {
        onSelectSession(session.session_id, sessionProject);
      }
      // Load JSONL history immediately so the card shows messages without requiring "Resume".
      const sid = session.session_id;
      if (!sessionMessagesMap[sid]?.length) {
        void (async () => {
          const sdkMessages = await ccGetSessionMessages(sid);
          for (const msg of fromSdkMessages(sdkMessages, sid)) {
            addMessageToSession(sid, msg);
          }
          setSessionLoading(sid, false);
        })();
      }
    },
    [
      directory,
      setCwd,
      setSelectedAgent,
      addAgentCard,
      setCurrentAgentCardId,
      setView,
      onSelectSession,
      sessionMessagesMap,
      addMessageToSession,
      setSessionLoading,
    ],
  );

  return {
    activeSessionIds,
    activeSessionId,
    isLoading,
    handleSessionClick,
  };
}
