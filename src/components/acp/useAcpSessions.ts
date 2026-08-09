import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  type AcpSessionRecord,
  acpDeleteSession,
  acpGetSession,
  acpListSessions,
  acpLoadSession,
  acpStart,
} from '@/services/apiAdapt/acp';
import { useWorkspaceStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { applyAcpUpdate } from './applyUpdate';

/**
 * The persisted ACP sessions of one project directory, plus the actions the
 * sidebar needs. Sessions are stored by the backend as they run: ACP has no
 * listing RPC of its own.
 */
export function useAcpSessions(directory: string) {
  const setCwd = useWorkspaceStore((s) => s.setCwd);
  const { sessionId, entries } = useAcpStore();
  const [sessions, setSessions] = useState<AcpSessionRecord[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!directory) return;
    try {
      setSessions(await acpListSessions(directory));
    } catch (e) {
      console.error('acp: failed to list sessions', e);
    }
  }, [directory]);

  // Re-list when the workspace changes, and after a turn lands in the store so
  // a new session shows up with its title.
  useEffect(() => {
    void refresh();
  }, [refresh, sessionId, entries.length]);

  /**
   * Open a stored session. Agents that advertise `loadSession` get a real
   * resume; for the others the transcript is replayed locally as history and
   * the new prompt starts a fresh agent-side session.
   */
  const open = useCallback(
    async (record: AcpSessionRecord) => {
      const store = useAcpStore.getState();
      // The running agent process was spawned in the old workspace, so a
      // session from another project always needs a fresh connection.
      const sameProject = useWorkspaceStore.getState().cwd === record.cwd;
      setOpening(record.sessionId);
      setCwd(record.cwd);
      try {
        let connectionId = store.connectionId;
        let canLoadSession = store.canLoadSession;

        // A different agent (or no live process) needs its own connection.
        if (!connectionId || !sameProject || store.agentId !== record.agentId) {
          const res = await acpStart(record.agentId, record.cwd);
          connectionId = res.connectionId;
          canLoadSession = res.initialize.agentCapabilities?.loadSession === true;
          store.setAgentId(record.agentId);
          store.setConnection({
            connectionId: res.connectionId,
            sessionId: res.sessionId,
            agentTitle:
              res.initialize.agentInfo?.title ?? res.initialize.agentInfo?.name ?? record.agentId,
            authMethods: res.initialize.authMethods ?? [],
            canLoadSession,
          });
          store.applySession(res.session);
        }

        store.setEntries([]);

        if (canLoadSession) {
          // The agent replays the transcript as live `session/update` events.
          const session = await acpLoadSession(connectionId, record.sessionId, record.cwd);
          store.applySession({ ...session, sessionId: record.sessionId });
        } else {
          for (const update of await acpGetSession(record.sessionId)) {
            applyAcpUpdate(update as Record<string, any>);
          }
        }
      } catch (e) {
        toast({ title: 'Failed to open session', description: String(e), variant: 'destructive' });
      } finally {
        setOpening(null);
      }
    },
    [setCwd]
  );

  const remove = useCallback(
    async (record: AcpSessionRecord) => {
      await acpDeleteSession(record.sessionId);
      if (useAcpStore.getState().sessionId === record.sessionId) useAcpStore.getState().restart();
      void refresh();
    },
    [refresh]
  );

  return { sessions, opening, refresh, open, remove };
}
