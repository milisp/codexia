import supabase from "@/lib/supabase";
import { listen, type UnlistenFn, isRemoteRuntime } from "@/lib/tauri-proxy";
import { useNavigationStore } from "@/stores";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const processedUrls = new Set<string>();

// useDeepLink hook: handles deep link auth
export const useDeepLink = () => {
  const [isHandlingDeepLink, setIsHandlingDeepLink] = useState(false);
  const { setMainView } = useNavigationStore();

  useEffect(() => {
    const handleUrl = async (urls: string[] | string) => {
      const url = Array.isArray(urls) ? urls[0] : urls;
      if (!url || processedUrls.has(url)) {
        return;
      }

      // Mark as processed BEFORE any async operations to prevent race conditions
      processedUrls.add(url);

      try {
        setIsHandlingDeepLink(true);
        const urlObj = new URL(url);
        const searchParams = new URLSearchParams(urlObj.search.substring(1));
        const code = searchParams.get("code");

        if (code && supabase) {
          // Check if already authenticated (skip if already logged in)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            return;
          }

          // Check if code verifier exists
          const codeVerifier = localStorage.getItem("supabase.auth.token-code-verifier");
          if (!codeVerifier) {
            console.error("Code verifier not found in localStorage");
            toast.error("Authentication state missing. Please try again.");
            return;
          }

          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error("Exchange code error:", error);
            throw error;
          }

          if (data.session) {
            toast.success("User authenticated successfully");
            // Reload page to reset app state
            window.location.reload();
            setMainView('home')
            return;
          }
        }
      } catch (err) {
        // DON'T remove from processedUrls - we don't want to retry
        console.error("Deep link authentication error:", err);
        toast.error("Authentication failed. Please sign in again.");
      } finally {
        setIsHandlingDeepLink(false);
      }
    };

    const setupDeepLinkHandlers = async () => {
      try {
        // Only access the deep-link plugin when running in the native Tauri runtime.
        // In remote browser runtime, the OS still delivers the deep link to the app
        // and the backend emits a `deep-link-received` event which we listen to below.
        if (!isRemoteRuntime()) {
          try {
            const mod = await import("@tauri-apps/plugin-deep-link");
            const current = await mod.getCurrent();
            if (current && current.length) {
              await handleUrl(current);
            }
          } catch (err) {
            console.error("Failed to read current deep link", err);
          }
        }
      } catch (err) {
        console.error("Failed to read current deep link", err);
      }

      let pluginUnlisten: UnlistenFn | null = null;
      try {
        if (!isRemoteRuntime()) {
          const mod = await import("@tauri-apps/plugin-deep-link");
          pluginUnlisten = await mod.onOpenUrl((incoming) => {
            void handleUrl(incoming);
          });
        }
      } catch (err) {
        console.error("Failed to register deep link handler", err);
      }

      // Only listen to backend events in remote runtime mode
      // In native mode, the plugin handles everything
      let eventUnlisten: UnlistenFn | null = null;
      if (isRemoteRuntime()) {
        try {
          eventUnlisten = await listen<string>("deep-link-received", (event) => {
            void handleUrl(event.payload);
          });
        } catch (err) {
          console.error("Failed to register native deep link listener", err);
        }
      }

      if (!pluginUnlisten && !eventUnlisten) {
        return null;
      }

      return () => {
        pluginUnlisten?.();
        eventUnlisten?.();
      };
    };

    let dispose: UnlistenFn | null = null;
    void setupDeepLinkHandlers().then((unlisten) => {
      dispose = unlisten ?? null;
    });

    return () => {
      dispose?.();
      processedUrls.clear();
    };
  }, []);

  return isHandlingDeepLink;
};
