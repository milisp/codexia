import { useEffect, useState } from 'react';
import { buildWsUrl } from '@/hooks/runtime';
import type { PublishProgress } from '@/services';

/** Follows `publish:progress` events for `slug` while `active` is true. */
export function usePublishProgress(slug: string, active: boolean) {
  const [progress, setProgress] = useState<PublishProgress | null>(null);

  useEffect(() => {
    if (!active) return;
    setProgress(null);
    const ws = new WebSocket(buildWsUrl('/ws'));
    ws.onmessage = (messageEvent) => {
      try {
        const envelope = JSON.parse(messageEvent.data as string) as {
          event?: string;
          payload?: PublishProgress;
        };
        if (envelope.event === 'publish:progress' && envelope.payload?.slug === slug) {
          setProgress(envelope.payload);
        }
      } catch {
        // Ignore unrelated or malformed frames.
      }
    };
    return () => ws.close();
  }, [slug, active]);

  return progress;
}
