import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtElapsed } from '@/components/agent/utils';
import type { TurnTiming } from '@/components/codex/stores/useCodexStore';

/** "Working… 0:12" while the turn runs, then "Worked 0:34" from turn.durationMs. */
export function WorkingIndicator({
  turnTiming,
  retryNotice,
}: {
  turnTiming: TurnTiming | undefined;
  retryNotice?: string;
}) {
  const { t } = useTranslation('thread');
  // Re-render only; elapsed is derived from startedAtMs, never stored.
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
        {t('working')} {fmtElapsed(elapsed)}
        {retryNotice && (
          <span className="text-yellow-600 dark:text-yellow-400"> · {retryNotice}</span>
        )}
      </div>
    );
  }

  if (turnTiming.durationMs === null) return null;

  return (
    <div className="text-xs text-muted-foreground/60">
      {t('worked')} {fmtElapsed(turnTiming.durationMs)}
    </div>
  );
}
