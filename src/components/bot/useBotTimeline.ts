import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';
import { applyAcpUpdate } from '@/components/acp/applyUpdate';
import { buildEventUrl, isDesktopTauri } from '@/hooks/runtime';
import { acpGetSession } from '@/services/apiAdapt/acp';
import { listBotSessions } from '@/services/apiAdapt/bots';
import { type AcpEntry, createAcpStore } from '@/stores/useAcpStore';

type TimelineSection = { sessionId: string; entries: AcpEntry[] };
type Transcript = ReturnType<typeof createAcpStore>;

type BotEvent =
  | { event: 'bot:activity'; payload: { botId?: string; status?: string } }
  | {
      event: 'acp-message';
      payload: {
        botId?: string;
        kind?: string;
        /** Set on a `session/load` replay of what is already stored. */
        replay?: boolean;
        sessionId?: string;
        update?: Record<string, unknown>;
      };
    };

function sectionEntries(sessionId: string, transcript: Transcript): AcpEntry[] {
  return transcript.getState().entries.map((entry) => ({
    ...entry,
    id: `${sessionId}:${entry.id}`,
  }));
}

/**
 * The bot's whole conversation: every stored session, oldest first. Sessions
 * other than the one open in the composer — scheduled and delegated runs —
 * follow their live updates as they stream, so a run is watchable from any
 * client, including one that opened mid-run. Stored work is independent of the
 * live runtime, so refreshes never erase a live turn.
 */
export function useBotTimeline(botId: string, activeSessionId?: string) {
  const [timeline, setTimeline] = useState<{
    botId: string;
    sections: TimelineSection[];
    error: string;
  }>({ botId, sections: [], error: '' });
  const [revision, setRevision] = useState(0);
  // One transcript per loaded section, so a live update folds into it in place.
  const transcripts = useRef(new Map<string, Transcript>());
  const loading = useRef(false);
  const stale = useRef(false);
  const activeRef = useRef(activeSessionId);
  useEffect(() => {
    activeRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    const reload = () => {
      // An update that arrives mid-load may be missing from what the load read;
      // load again once it lands rather than lose it.
      if (loading.current) stale.current = true;
      else setRevision((value) => value + 1);
    };
    const handle = ({ event, payload }: BotEvent) => {
      if (payload.botId !== botId) return;
      if (event === 'bot:activity') {
        if (payload.status !== 'working') reload();
        return;
      }
      const sessionId = payload.sessionId;
      if (payload.kind !== 'update' || payload.replay || !payload.update || !sessionId) return;
      // The open session is drawn from the live composer store.
      if (sessionId === activeRef.current) return;
      const transcript = transcripts.current.get(sessionId);
      if (!transcript || loading.current) {
        reload();
        return;
      }
      applyAcpUpdate(payload.update, transcript.getState());
      setTimeline((previous) =>
        previous.botId !== botId
          ? previous
          : {
              ...previous,
              sections: previous.sections.map((section) =>
                section.sessionId === sessionId
                  ? { sessionId, entries: sectionEntries(sessionId, transcript) }
                  : section
              ),
            }
      );
    };

    if (isDesktopTauri()) {
      const stops = [
        listen<BotEvent['payload']>('bot:activity', (e) =>
          handle({ event: 'bot:activity', payload: e.payload } as BotEvent)
        ),
        listen<BotEvent['payload']>('acp-message', (e) =>
          handle({ event: 'acp-message', payload: e.payload } as BotEvent)
        ),
      ];
      return () => {
        for (const stop of stops) void stop.then((fn) => fn());
      };
    }
    const events = new EventSource(buildEventUrl('/api/events'));
    events.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as BotEvent;
        if (envelope.event === 'bot:activity' || envelope.event === 'acp-message') handle(envelope);
      } catch {
        /* Ignore unrelated or malformed event envelopes. */
      }
    };
    // Updates sent while disconnected are lost: re-read the stored transcripts.
    events.onopen = reload;
    return () => events.close();
  }, [botId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Activity and retry revisions intentionally reload historical transcripts.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      loading.current = true;
      stale.current = false;
      try {
        const sessions = await listBotSessions(botId, 500);
        sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const loaded = new Map<string, Transcript>();
        const sections = await Promise.all(
          sessions.map(async (session) => {
            if (session.sessionId === activeSessionId) {
              return { sessionId: session.sessionId, entries: [] };
            }
            const updates = await acpGetSession(session.sessionId);
            const transcript = createAcpStore();
            for (const update of updates) applyAcpUpdate(update, transcript.getState());
            loaded.set(session.sessionId, transcript);
            return {
              sessionId: session.sessionId,
              entries: sectionEntries(session.sessionId, transcript),
            };
          })
        );
        if (!cancelled) {
          transcripts.current = loaded;
          setTimeline({ botId, sections, error: '' });
        }
      } catch (failure) {
        if (!cancelled)
          setTimeline((previous) => ({
            botId,
            sections: previous.botId === botId ? previous.sections : [],
            error: `Could not load earlier messages: ${String(failure)}`,
          }));
      } finally {
        loading.current = false;
        if (!cancelled && stale.current) setRevision((value) => value + 1);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [botId, activeSessionId, revision]);

  const sections = timeline.botId === botId ? timeline.sections : [];
  return {
    sections,
    error: timeline.botId === botId ? timeline.error : '',
    retry: () => setRevision((value) => value + 1),
  };
}
