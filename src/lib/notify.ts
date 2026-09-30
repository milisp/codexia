import { isDesktopTauri } from '@/hooks/runtime';

let permission: boolean | null = null;

async function ensurePermission(): Promise<boolean> {
  if (permission !== null) return permission;
  const { isPermissionGranted, requestPermission } = await import(
    '@tauri-apps/plugin-notification'
  );
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === 'granted';
  permission = granted;
  return granted;
}

/**
 * Sends a system notification on desktop Tauri. Calls `fallback` (typically an
 * in-app toast) when not on desktop, permission is denied, or anything fails.
 */
export async function notifyDesktop(
  title: string,
  body?: string,
  fallback?: () => void
): Promise<void> {
  try {
    if (isDesktopTauri() && (await ensurePermission())) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
      return;
    }
  } catch (e) {
    console.error('notify: system notification failed', e);
  }
  fallback?.();
}
