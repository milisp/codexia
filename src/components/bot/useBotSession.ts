import { useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { acpGetSession, acpLoadSession, acpStart } from '@/services/apiAdapt/acp';
import type { Bot } from '@/services/apiAdapt/bots';
import { listBotSessions } from '@/services/apiAdapt/bots';
import { useAcpStore } from '@/stores/useAcpStore';
import { captureBotOptions } from '@/stores/useBotOptionsStore';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { applyAcpUpdate } from '../acp/applyUpdate';
import { loadAcpAgents } from '../acp/useAcpAgents';

/** Replay only the active runtime transcript; older work belongs to the Bot timeline. */
async function replayCurrent(botId: string, sessionId: string) {
  const updates = await acpGetSession(sessionId);
  if (useBotUiStore.getState().selectedBotId !== botId) return;
  for (const update of updates) applyAcpUpdate(update as Record<string, any>);
}

/**
 * Opening a bot's conversation.
 *
 * A bot is its own long-lived keke process: the connection is kept in
 * `useBotUiStore` so coming back to a bot costs nothing, and only the very
 * first message pays for a spawn. Nothing here runs while the sidebar merely
 * lists bots — that read is deliberately cold.
 */
export function useBotSession() {
  /**
   * Show a bot's conversation, starting its process if it has none. Returns the
   * live ids, or null when the bot could not be opened.
   */
  const open = useCallback(async (bot: Bot) => {
    const ui = useBotUiStore.getState();
    const store = useAcpStore.getState();

    ui.setSelectedBotId(bot.id);
    store.setAgentId(bot.agentId);

    // Opening is async and the ACP store holds exactly one conversation, so
    // every write to it after an await has to check that this bot is still
    // the one on screen — otherwise a slow bot lands in a faster one's pane.
    const stale = () => useBotUiStore.getState().selectedBotId !== bot.id;

    const existing = ui.connectionByBot[bot.id];
    const existingSession = ui.sessionByBot[bot.id];
    if (existing && existingSession) {
      const activeSessionId = existingSession;
      store.setConnection({
        connectionId: existing,
        sessionId: activeSessionId,
        agentTitle: bot.name,
        authMethods: [],
        canLoadSession: store.canLoadSession,
      });
      store.setEntries([]);
      await replayCurrent(bot.id, activeSessionId);
      return { connectionId: existing, sessionId: activeSessionId };
    }

    // Neither a local `keke` nor `npx` resolved: there is nothing to spawn.
    // The composer shows an install prompt for this instead of a toast.
    // Awaited fresh rather than read off `useAcpAgents`' hook state, which
    // can still be the pre-fetch empty array on a component's first render.
    const keke = (await loadAcpAgents()).find((a) => a.id === 'keke');
    console.log('bot: opening', bot.name, 'with keke', keke);
    if (!keke || !keke.local) {
      store.setEntries([]);
      return null;
    }

    store.setConnecting(true);
    store.setEntries([]);
    try {
      // The backend builds the bot's process itself from the stored bot
      // (args, instructions, memory, MCP servers) and applies its session
      // settings to the first session, so no definition is passed here.
      const res = await acpStart(bot.agentId, bot.cwd, undefined, bot.id);
      if (res.connectionId) ui.setBotConnection(bot.id, res.connectionId);
      if (res.sessionId) ui.setBotSession(bot.id, res.sessionId);
      if (stale()) {
        return res.sessionId ? { connectionId: res.connectionId, sessionId: res.sessionId } : null;
      }
      const canLoadSession = res.initialize.agentCapabilities?.loadSession === true;
      const sessionToRestore = (await listBotSessions(bot.id))[0];
      if (stale()) return null;
      const restoreStoredSession = Boolean(sessionToRestore && canLoadSession);
      let activeSessionId = restoreStoredSession ? sessionToRestore!.sessionId : res.sessionId;

      // The store's connection/session must be set — and entries cleared —
      // before `session/load` is awaited below: the agent streams the
      // replayed transcript as live `session/update` events the moment it
      // starts, and those need this bot's (now-empty) entries to land in,
      // not whatever was on screen before or a later `applySession` that
      // would otherwise double them up.
      store.setConnection({
        connectionId: res.connectionId,
        sessionId: activeSessionId,
        agentTitle: bot.name,
        authMethods: res.initialize.authMethods ?? [],
        canLoadSession,
      });
      if (restoreStoredSession && sessionToRestore) {
        store.setEntries([]);
        try {
          const restored = await acpLoadSession(
            res.connectionId,
            sessionToRestore.sessionId,
            sessionToRestore.cwd
          );
          if (stale()) return null;
          store.applySession({ ...restored, sessionId: sessionToRestore.sessionId });
          ui.setBotSession(bot.id, sessionToRestore.sessionId);
        } catch (e) {
          // The agent may claim `loadSession` support yet still fail to
          // resume a session from a previous process (e.g. it only kept it
          // in memory) — fall back to the fresh session rather than let the
          // whole bot fail to open over a stale session id.
          console.warn(`bot: ${bot.name} could not resume session, starting fresh`, e);
          if (stale()) return null;
          activeSessionId = res.sessionId;
          if (res.sessionId) ui.setBotSession(bot.id, res.sessionId);
          store.setConnection({
            connectionId: res.connectionId,
            sessionId: res.sessionId,
            agentTitle: bot.name,
            authMethods: res.initialize.authMethods ?? [],
            canLoadSession,
          });
          store.applySession(res.session);
        }
      } else {
        store.applySession(res.session);
      }
      // Remember what keke offers, so a bot that has never run can still be
      // configured from a list rather than typed-in provider/model strings.
      captureBotOptions(bot.provider, res.initialize, res.session);

      if (res.sessionError || !res.sessionId) {
        store.addEntry({
          id: `start-${Date.now()}`,
          role: 'error',
          text: res.sessionError ?? 'keke opened no session.',
        });
        return null;
      }
      ui.setKekeSpawnFailed(false);

      return activeSessionId
        ? { connectionId: res.connectionId, sessionId: activeSessionId }
        : null;
    } catch (e) {
      // `available` said keke would run — a packaged app's PATH not
      // matching the shell's is the usual reason it didn't anyway. Once
      // that happens, show the install prompt instead of retrying and
      // toasting on every message.
      if (/failed to spawn|no such file|not found|enoent/i.test(String(e))) {
        ui.setKekeSpawnFailed(true);
      } else {
        toast({
          title: `Could not start ${bot.name}`,
          description: String(e),
          variant: 'destructive',
        });
      }
      return null;
    } finally {
      if (!stale()) store.setConnecting(false);
    }
  }, []);

  /**
   * Show a bot that has nothing to show yet — a freshly created one. Creating a
   * bot never starts its process, so without this the pane would keep
   * rendering the previous bot's conversation, which the ACP store still holds.
   */
  const openBlank = useCallback((bot: Bot) => {
    useAcpStore.getState().reset();
    useAcpStore.getState().setAgentId(bot.agentId);
    useBotUiStore.getState().setSelectedBotId(bot.id);
  }, []);

  return { open, openBlank };
}
