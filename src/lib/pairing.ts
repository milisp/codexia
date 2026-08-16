import { DEFAULT_PORT } from '@/hooks/runtime';
import type { PairedDesktop } from '@/stores/usePairingStore';

/**
 * The pairing payload encoded in the desktop's QR code.
 *
 * A custom scheme rather than a URL so a code scanned by the system camera app
 * offers to open Codexia instead of a browser. The token travels in the clear
 * inside it, which is why the desktop keeps the code hidden until asked.
 */
export function buildPairingUri(desktop: PairedDesktop): string {
  const params = new URLSearchParams({
    host: desktop.host,
    port: String(desktop.port),
    token: desktop.token,
  });
  if (desktop.name) params.set('name', desktop.name);
  return `codexia://pair?${params.toString()}`;
}

/**
 * Reads a scanned code back into a pairing, or null when it is some other QR
 * code the user happened to point the camera at.
 */
export function parsePairingUri(raw: string): PairedDesktop | null {
  const text = raw.trim();
  if (!text.toLowerCase().startsWith('codexia://pair')) return null;

  // `URL` refuses to expose searchParams for unknown schemes on some engines,
  // so the query is split off by hand.
  const query = text.slice(text.indexOf('?') + 1);
  const params = new URLSearchParams(text.includes('?') ? query : '');

  const host = params.get('host')?.trim();
  const token = params.get('token')?.trim();
  if (!host || !token) return null;

  return {
    name: params.get('name')?.trim() ?? '',
    host,
    port: Number(params.get('port')) || DEFAULT_PORT,
    token,
  };
}
