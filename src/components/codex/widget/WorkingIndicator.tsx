import { useEffect, useState } from 'react';
import { fmtElapsed } from '@/components/agent/utils';
import type { TurnTiming } from '@/components/codex/stores/useCodexStore';

/**
 * Shows "Working… 0:12" while a turn is in progress (ticking from the store's
 * turnTimingMap, which is updated directly by turn/started + turn/completed +
 * error — see TurnTiming), then flips to "Worked 0:34" / "Failed after 0:12" /
 * "Stopped after 0:08" once the turn ends, using the server-reported
 * turn.durationMs so the number is accurate even on error/interrupt.
 */
export function WorkingIndicator({ turnTiming }: { turnTiming: TurnTiming | undefined }) {
  // `tick` only forces a re-render every 200ms; elapsed time itself is
  // derived from turnTiming.startedAtMs, not synced into state.
  const [, setTick] = useState(0);
  const inProgress = turnTiming?.status === 'inProgress';

  useEffect(() => {
    if (!inProgress) return;

    const intervalId = setInterval(() => {
      setTick((t) => t + 1);
    }, 200);

    return () => clearInterval(intervalId);
  }, [inProgress]);

  const elapsed = inProgress && turnTiming ? Date.now() - turnTiming.startedAtMs : 0;

  if (!turnTiming) return null;

  if (inProgress) {
    return (
      <div className="text-sm text-muted-foreground animate-pulse">
        Working… {fmtElapsed(elapsed)}
      </div>
    );
  }

  if (turnTiming.durationMs === null) return null;

  return (
    <div className="text-xs text-muted-foreground/60">
      Worked {fmtElapsed(turnTiming.durationMs)}
    </div>
  );
}
