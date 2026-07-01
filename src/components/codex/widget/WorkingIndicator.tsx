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
  const [elapsed, setElapsed] = useState(0);
  const inProgress = turnTiming?.status === 'inProgress';

  useEffect(() => {
    if (!inProgress || !turnTiming) {
      setElapsed(0);
      return;
    }

    const { startedAtMs } = turnTiming;
    setElapsed(Date.now() - startedAtMs);
    const intervalId = setInterval(() => {
      setElapsed(Date.now() - startedAtMs);
    }, 200);

    return () => clearInterval(intervalId);
  }, [inProgress, turnTiming]);

  if (!turnTiming) return null;

  if (inProgress) {
    return (
      <div className="text-sm text-muted-foreground animate-pulse">
        Working… {fmtElapsed(elapsed)}
      </div>
    );
  }

  if (turnTiming.durationMs === null) return null;

  const label =
    turnTiming.status === 'failed'
      ? 'Failed after'
      : turnTiming.status === 'interrupted'
        ? 'Stopped after'
        : 'Worked';

  return (
    <div className="text-xs text-muted-foreground/60">
      {label} {fmtElapsed(turnTiming.durationMs)}
    </div>
  );
}
