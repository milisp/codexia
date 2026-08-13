import { buildEventUrl } from '@/hooks/runtime';

/** One frame from `/api/events`. `seq` is global and monotonic per server run. */
export interface EventEnvelope {
  seq: number;
  event: string;
  payload: unknown;
}

interface OpenEventStreamOptions {
  /** Namespaces to receive, e.g. `['codex']`. Omit to receive everything. */
  agents?: string[];
  onEvent: (envelope: EventEnvelope) => void;
  /** Prefix for console diagnostics, e.g. `'[CCSession]'`. */
  label?: string;
}

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 10_000;

/**
 * Subscribes to the server event stream, resuming from the last processed
 * sequence number after a dropped connection.
 *
 * EventSource reconnects on its own, but always to the original URL, so events
 * emitted while disconnected were silently lost — which mobile clients hit
 * constantly since the OS suspends connections on backgrounding. Reconnecting
 * manually lets us carry a `?since=` cursor and have the server replay the gap.
 *
 * Returns a cleanup function that stops the stream and any pending retry.
 */
export function openEventStream({ agents, onEvent, label = '[events]' }: OpenEventStreamOptions) {
  let lastSeq: number | null = null;
  let retryMs = INITIAL_RETRY_MS;
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const url = () => {
    const params = new URLSearchParams();
    if (agents?.length) {
      params.set('agents', agents.join(','));
    }
    if (lastSeq !== null) {
      params.set('since', String(lastSeq));
    }
    const qs = params.toString();
    return buildEventUrl(`/api/events${qs ? `?${qs}` : ''}`);
  };

  const connect = () => {
    if (closed) return;

    const target = url();
    const es = new EventSource(target);
    source = es;

    es.onopen = () => {
      retryMs = INITIAL_RETRY_MS;
      console.info(`${label} event stream connected`, { url: target, since: lastSeq });
    };

    es.onmessage = (e) => {
      try {
        const envelope = JSON.parse(e.data as string) as EventEnvelope;
        if (typeof envelope.seq === 'number') {
          lastSeq = envelope.seq;
        }
        onEvent(envelope);
      } catch (err) {
        console.warn(`${label} failed to parse event frame`, err);
      }
    };

    es.onerror = () => {
      // The server also ends the stream deliberately when a client lags, so
      // treat every error the same way: reconnect carrying the cursor.
      es.close();
      if (closed) return;

      console.warn(`${label} event stream dropped, retrying`, { in: retryMs, since: lastSeq });
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    };
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    source?.close();
  };
}
