// ─── Codex Utilities ──────────────────────────────────────────────────────

import type { ServerNotification } from '@/bindings';
import type { TurnTiming } from '@/components/codex/stores/useCodexStore';

/**
 * Extracts the current active turn ID from a TurnTiming record.
 * Returns null if there is no in-progress turn.
 *
 * Prefer this over scanning raw events: turnTimingMap is updated directly by
 * turn/started + turn/completed + error, so it can't disagree with itself
 * the way independently scanning the events array for those same methods can
 * (e.g. when an error notification arrives without a matching turn/completed).
 */
export function getCodexActiveTurnId(timing: TurnTiming | undefined): string | null {
  return timing?.status === 'inProgress' ? timing.turnId : null;
}

/**
 * Gets total token usage from events.
 * Returns null if not found.
 */
export function getCodexTokens(events: ServerNotification[]): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.method === 'thread/tokenUsage/updated') {
      const total = (e.params as any)?.tokenUsage?.total?.totalTokens;
      return typeof total === 'number' ? total : null;
    }
  }
  return null;
}

/**
 * Extracts context window usage info from events.
 * Returns null if not found.
 */
export function getCodexContextWindow(
  events: ServerNotification[]
): { used: number; window: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.method === 'thread/tokenUsage/updated') {
      const tu = e.params as any;
      const used = tu?.tokenUsage?.total?.totalTokens;
      const win = tu?.modelContextWindow;
      if (typeof used === 'number' && typeof win === 'number' && win > 0) {
        return { used, window: win };
      }
    }
  }
  return null;
}

/**
 * Formats token count with 'k' suffix for 1000+ tokens.
 * @param n - Token count to format.
 * @returns Formatted string like "1.5k" or "500".
 */
export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/**
 * Formats elapsed time into minutes:seconds.
 * @param ms - Elapsed time in milliseconds.
 * @returns Formatted string like "5:30" or "0:30".
 */
export function fmtElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
}
