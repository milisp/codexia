/**
 * On desktop: API calls go directly to localhost.
 * On iOS/mobile: fetch the user's desktop tunnel URL from milisp.dev,
 * then proxy all API calls through it.
 */

import supabase from '@/lib/supabase';

interface TauriInternals {
  metadata?: {
    currentWindow?: unknown;
  };
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

let cachedUrl: string | null = null;
let fetchedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function isMobile(): boolean {
  // Tauri sets __TAURI_INTERNALS__ but not on iOS WKWebView when running mobile
  // Simplest: check if window.__TAURI__ exists and platform is ios
  return (
    typeof window !== 'undefined' &&
    window.__TAURI_INTERNALS__?.metadata?.currentWindow == null &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

async function getDesktopUrl(): Promise<string> {
  const now = Date.now();
  if (cachedUrl && now - fetchedAt < CACHE_TTL) return cachedUrl;

  if (!supabase) throw new Error('Supabase not configured');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  const res = await fetch('https://milisp.dev/api/desktop/url', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error('Desktop not registered — open Codexia on your Mac first');

  const { url } = await res.json();
  cachedUrl = url;
  fetchedAt = now;
  return url;
}

/**
 * Returns the base URL to use for API calls.
 * Desktop: '' (relative, hits localhost via Tauri)
 * iOS: the user's tunnel URL
 */
export async function getApiBase(): Promise<string> {
  if (!isMobile()) return '';
  return getDesktopUrl();
}

export function clearDesktopUrlCache() {
  cachedUrl = null;
  fetchedAt = 0;
}
