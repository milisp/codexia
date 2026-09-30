export const EVENT_NAMES = [
  'app_active',
  'bot_created',
  'bot_routine_created',
  'bot_run_done',
  'bot_run_blocked',
  'bot_run_failed',
  'bot_ask',
] as const;
export const PLATFORMS = ['macos', 'windows', 'linux', 'ios', 'android', 'web'] as const;
export const ARCHES = ['x86_64', 'aarch64', 'unknown'] as const;

export const MAX_EVENTS = 20;
export const MAX_BODY_BYTES = 8 * 1024;

const VERSION_RE = /^\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?$/;

export interface TelemetryEvent {
  name: string;
  version: string;
  platform: string;
  arch: string;
}

function isOneOf(list: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && list.includes(value);
}

export function parseEvent(raw: unknown): TelemetryEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (!isOneOf(EVENT_NAMES, e.name)) return null;
  if (typeof e.version !== 'string' || e.version.length > 32 || !VERSION_RE.test(e.version)) {
    return null;
  }
  if (!isOneOf(PLATFORMS, e.platform)) return null;
  if (!isOneOf(ARCHES, e.arch)) return null;
  return { name: e.name, version: e.version, platform: e.platform, arch: e.arch };
}

/** Returns valid events (invalid ones dropped) or null when the payload shape is wrong. */
export function parseBatch(body: unknown): TelemetryEvent[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length > MAX_EVENTS) return null;
  const out: TelemetryEvent[] = [];
  for (const raw of events) {
    const ev = parseEvent(raw);
    if (ev) out.push(ev);
  }
  return out;
}
