import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useEffect, useRef } from 'react';

// Single global tracking instance to prevent double-processing identical links
const processedUrls = new Set<string>();

export const useDeepLink = (onUrlReceived: (url: string) => void) => {
  const callbackRef = useRef(onUrlReceived);
  callbackRef.current = onUrlReceived;

  useEffect(() => {
    let unlisteners: (UnlistenFn | (() => void))[] = [];

    const initDeepLink = async () => {
      const handleUrl = (urls: string[] | string | null) => {
        const url = Array.isArray(urls) ? urls[0] : urls;
        if (!url || processedUrls.has(url)) return;

        processedUrls.add(url);
        callbackRef.current(url);
      };

      try {
        // 1. Handle cold start (App opened via deep link)
        const current = await getCurrent();
        if (current) handleUrl(current);

        // 2. Handle runtime links (App already running)
        unlisteners.push(await onOpenUrl((incoming) => handleUrl(incoming)));
        unlisteners.push(await listen<string>('deep-link-received', (e) => handleUrl(e.payload)));
      } catch (err) {
        console.error('Failed to setup deep link listeners:', err);
      }
    };

    void initDeepLink();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
      processedUrls.clear();
    };
  }, []);
};