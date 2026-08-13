import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  type AcpSessionRecord,
  acpDeleteSession,
  acpGetSession,
  acpListSessions,
  acpLoadSession,
  acpNewSession,
  acpStart,
} from '@/services/apiAdapt/acp';
import { useWorkspaceStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { applyAcpUpdate } from './applyUpdate';
import { acpFreshSession } from './newSession';

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberate re-list triggers, not values refresh reads
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
      setOpening(record.sessionId);
      setCwd(record.cwd);
      try {
        let connectionId = store.connectionId;
        let canLoadSession = store.canLoadSession;
        // Whether the connection was spawned right here, in which case it
        // already carries a fresh session from `session/new`.
        let startedFresh = false;

        // Only a different agent (or no live process) needs its own connection:
        // cwd is a session-level parameter, so the running process can serve a
        // session in another project too.
        if (!connectionId || store.agentId !== record.agentId) {
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
          startedFresh = true;
        }

        store.setEntries([]);

        if (canLoadSession) {
          // The agent replays the transcript as live `session/update` events,
          // so the pane must already point at this session or the replay is
          // filtered out as belonging to another one.
          store.setSessionId(record.sessionId);
          const session = await acpLoadSession(connectionId, record.sessionId, record.cwd);
          store.applySession({ ...session, sessionId: record.sessionId });
        } else {
          // The agent cannot resume this session, so the stored transcript is
          // shown as history only. The next prompt needs a session the agent
          // process actually knows — reuse the one it was just started with,
          // else open a new one, so prompts do not target the dead id.
          if (!startedFresh) {
            store.applySession(await acpNewSession(connectionId, record.cwd));
          }
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
      const store = useAcpStore.getState();
      if (store.sessionId === record.sessionId) {
        // Deleting the open session only needs another session on the same
        // process; restarting the agent is the fallback.
        const cwd = useWorkspaceStore.getState().cwd;
        const reused =
          store.connectionId && cwd ? await acpFreshSession(store.connectionId, cwd) : false;
        if (!reused) store.restart();
      }
      void refresh();
    },
    [refresh]
  );

  return { sessions, opening, refresh, open, remove };
}
