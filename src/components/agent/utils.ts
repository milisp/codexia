// ─── Codex Utilities ──────────────────────────────────────────────────────

import { ServerNotification } from "@/bindings";

/**
 * Extracts the current active turn ID from events.
 * Returns null if no active turn found.
 */
export function getCodexActiveTurnId(events: ServerNotification[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.method === 'turn/started') {
      return (e.params as { turn: { id: string } }).turn.id;
    }
    if (e.method === 'turn/completed' || e.method === 'error') {
      return null;
    }
  }
  return null;
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
 * @param s - Elapsed time in seconds.
 * @returns Formatted string like "5:30" or "0:30".
 */
export function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
}
