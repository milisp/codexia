const DEFAULT_PORT = 7420;
const configuredPort = Number(import.meta.env.VITE_WEB_PORT || DEFAULT_PORT);

// Sync UA-based phone detection — good enough for routing guards.
// Note: unreliable at Tauri injection time, but stable once JS runs.
const _isTauri = () =>
  typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

const _uaIsPhone = () =>
  typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/.test(window.navigator.userAgent);

const resolveApiBase = () => {
  if (typeof window === 'undefined') {
    return `http://127.0.0.1:${configuredPort}`;
  }

  if (_isTauri() && _uaIsPhone()) {
    if (!import.meta.env.PROD) {
      // Dev: frontend is served from the Vite dev server (Mac's LAN IP).
      // Route API calls to the same host so a real iPhone can reach the
      // Mac's backend over LAN without needing the P2P tunnel.
      const host = window.location.hostname || '127.0.0.1';
      return `http://${host}:${configuredPort}`;
    }
    // Prod: P2P proxy listens on device localhost.
    // Must use 'localhost' hostname, not '127.0.0.1' IP — WebKit exempts localhost
    // from mixed-content blocking when the page origin is tauri://localhost (secure).
    return `http://localhost:${configuredPort}`;
  }

  if (import.meta.env.PROD) {
    // Desktop web-server: assets and API share the same origin.
    return window.location.origin;
  }

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const host = window.location.hostname || '127.0.0.1';
  return `${protocol}://${host}:${configuredPort}`;
};

export const buildUrl = (path: string) => `${resolveApiBase()}${path}`;

const resolveWsBase = () => {
  if (typeof window === 'undefined') {
    return `ws://127.0.0.1:${configuredPort}`;
  }

  if (_isTauri() && _uaIsPhone()) {
    if (!import.meta.env.PROD) {
      // Dev: same host as Vite server for LAN access from real device.
      const host = window.location.hostname || '127.0.0.1';
      return `ws://${host}:${configuredPort}`;
    }
    // Prod: P2P proxy listens on device localhost.
    return `ws://localhost:${configuredPort}`;
  }

  if (import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname || '127.0.0.1';
  return `${protocol}://${host}:${configuredPort}`;
};

export const buildWsUrl = (path: string) => `${resolveWsBase()}${path}`;

export const isTauri = () => _isTauri();

export const isMacos =
  isTauri() && /Macintosh|MacIntel|MacPPC|Mac68K/.test(window.navigator.userAgent);

// Unreliable on real iOS devices (Tauri injection timing); use getIsPhone() instead.
export const isPhone = isTauri() && _uaIsPhone();

/** True only on desktop Tauri — use this to guard invokeTauri() calls.
 *  Uses the plugin-os cache (_isPhone) when available, falls back to UA. */
export const isDesktopTauri = () => {
  if (!isTauri()) return false;
  // Use the reliable cached value from getIsPhone() if already resolved.
  if (_isPhone !== null) return !_isPhone;
  // Fall back to UA (good enough after app has started).
  return !_uaIsPhone();
};

import { type as osType } from '@tauri-apps/plugin-os';

let _isPhone: boolean | null = null;

/** Reliable platform detection via plugin-os. Cached after first call. */
export async function getIsPhone(): Promise<boolean> {
  if (_isPhone !== null) return _isPhone;
  if (!isTauri()) {
    _isPhone = false;
    return false;
  }
  try {
    const t = await osType();
    _isPhone = t === 'ios' || t === 'android';
  } catch {
    _isPhone = isPhone; // fallback to userAgent
  }
  return _isPhone;
}
