// Hook to provide a unified way to open external URLs, handling Tauri vs browser environments.

import { isTauri } from '@/hooks/runtime';

/**
 * Returns a function that opens a URL in a new tab or via the Tauri opener plugin.
 *
 * Usage:
 *   const { openExternalUrl } = useExternalUrl();
 *   await openExternalUrl('https://example.com');
 */
export function useExternalUrl() {
  const openExternalUrl = async (url: string) => {
    if (isTauri()) {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return { openExternalUrl };
}
