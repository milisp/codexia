/**
 * Anonymous, opt-in usage counters.
 *
 * Sends only an event name, the app version, the OS and the CPU architecture,
 * at most once per event name per UTC day per device, to the maintainer's own
 * endpoint (`VITE_TELEMETRY_URL`). No identifier of any kind is sent or stored.
 * See docs/PRIVACY.md.
 */
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { arch, platform } from '@tauri-apps/plugin-os';
import { useSettingsStore } from '@/stores/settings/useSettingsStore';

export type TelemetryEvent =
  | 'app_active'
  | 'bot_created'
  | 'bot_routine_created'
  | 'bot_run_done'
  | 'bot_run_blocked'
  | 'bot_run_failed'
  | 'bot_ask';

type Platform = 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'web';
type Arch = 'x86_64' | 'aarch64' | 'unknown';

const STORAGE_KEY = 'codexia-telemetry-sent';
const FLUSH_DELAY_MS = 5000;

const pending = new Set<TelemetryEvent>();
let scheduled = false;

/** The configured endpoint, or undefined when telemetry is not built in. */
export function telemetryEndpoint(): string | undefined {
  const url = import.meta.env.VITE_TELEMETRY_URL;
  return typeof url === 'string' && url.trim() ? url.trim() : undefined;
}

export function isTelemetryAvailable(): boolean {
  return telemetryEndpoint() !== undefined && !doNotTrack();
}

function doNotTrack(): boolean {
  return typeof navigator !== 'undefined' && navigator.doNotTrack === '1';
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function readSent(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSent(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

async function describeDevice(): Promise<{
  version: string;
  platform: Platform;
  arch: Arch;
}> {
  // The collector only counts `x.y.z` versions, so the web build reports the
  // version it was built from rather than a label.
  if (!isTauri()) return { version: __APP_VERSION__, platform: 'web', arch: 'unknown' };
  let version = __APP_VERSION__;
  try {
    version = await getVersion();
  } catch {}
  let os: Platform = 'linux';
  let cpu: Arch = 'unknown';
  try {
    const p = platform();
    if (p === 'macos' || p === 'windows' || p === 'ios' || p === 'android') os = p;
    const a = arch();
    if (a === 'x86_64' || a === 'aarch64') cpu = a;
  } catch {}
  return { version, platform: os, arch: cpu };
}

async function flush() {
  scheduled = false;
  const endpoint = telemetryEndpoint();
  const names = [...pending];
  pending.clear();
  if (!endpoint || names.length === 0) return;
  try {
    const device = await describeDevice();
    const events = names.map((name) => ({ name, ...device }));
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  } catch {}
}

/** Record one event. No-op without consent, endpoint, or when the browser sends DNT. */
export function track(name: TelemetryEvent): void {
  try {
    if (!isTelemetryAvailable()) return;
    if (useSettingsStore.getState().telemetryConsent !== 'granted') return;
    const sent = readSent();
    const today = utcDay();
    if (sent[name] === today || pending.has(name)) return;
    writeSent({ ...sent, [name]: today });
    pending.add(name);
    if (!scheduled) {
      scheduled = true;
      setTimeout(flush, FLUSH_DELAY_MS);
    }
  } catch {}
}
