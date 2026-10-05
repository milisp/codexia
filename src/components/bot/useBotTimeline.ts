import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { applyAcpUpdate } from '@/components/acp/applyUpdate';
import { buildEventUrl, isDesktopTauri } from '@/hooks/runtime';
import { acpGetSession } from '@/services/apiAdapt/acp';
import { listBotSessions } from '@/services/apiAdapt/bots';
import { type AcpEntry, createAcpStore } from '@/stores/useAcpStore';

type TimelineSection = { sessionId: string; entries: AcpEntry[] };

/** Stored work is independent of the live runtime, so refreshes never erase a live turn. */
export function useBotTimeline(botId: string, activeSessionId?: string) {
  const [timeline, setTimeline] = useState<{
    botId: string;
    sections: TimelineSection[];
    error: string;
  }>({ botId, sections: [], error: '' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = (payload: { botId?: string; status?: string }) => {
      if (payload.botId === botId && payload.status !== 'working') {
        setRevision((value) => value + 1);
      }
    };
    if (isDesktopTauri()) {
      const unlisten = listen<{ botId: string; status: string }>('bot:activity', (event) =>
        refresh(event.payload)
      );
      return () => {
        void unlisten.then((stop) => stop());
      };
    }
    const events = new EventSource(buildEventUrl('/api/events'));
    events.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data);
        if (envelope.event === 'bot:activity') refresh(envelope.payload);
      } catch {
        /* Ignore unrelated or malformed event envelopes. */
      }
    };
    return () => events.close();
  }, [botId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Activity and retry revisions intentionally reload historical transcripts.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const sessions = await listBotSessions(botId, 500);
        sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const sections = await Promise.all(
          sessions.map(async (session) => {
            if (session.sessionId === activeSessionId) {
              return { sessionId: session.sessionId, entries: [] };
            }
            const updates = await acpGetSession(session.sessionId);
            const transcript = createAcpStore();
            for (const update of updates) applyAcpUpdate(update, transcript.getState());
            return {
              sessionId: session.sessionId,
              entries: transcript.getState().entries.map((entry) => ({
                ...entry,
                id: `${session.sessionId}:${entry.id}`,
              })),
            };
          })
        );
        if (!cancelled) setTimeline({ botId, sections, error: '' });
      } catch (failure) {
        if (!cancelled)
          setTimeline((previous) => ({
            botId,
            sections: previous.botId === botId ? previous.sections : [],
            error: `Could not load earlier messages: ${String(failure)}`,
          }));
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
