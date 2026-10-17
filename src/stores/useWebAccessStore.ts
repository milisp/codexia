import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WebAccessState = {
  /**
   * Device token for the server that served this page.
   *
   * Only the browser build reads it: a remote browser talks to the same
   * origin it was loaded from, which needs the token unless it is loopback
   * (see `require_device_token` in `web/src/auth.rs`). The phone app keeps
   * its tokens per paired machine in `usePairingStore` instead.
   */
  token: string | null;
  setToken: (token: string | null) => void;
};

export const useWebAccessStore = create<WebAccessState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
    }),
    {
      name: 'codexia.web-access',
      version: 1,
      partialize: (state) => ({ token: state.token }),
    }
  )
);

/**
 * Takes a token handed over in the URL fragment (`/#token=…`, printed by
 * `codexia-web pair`) and removes it from the address bar, so it is not left
 * in history or shared with a copied link. Fragments never reach the server.
 */
export function captureTokenFromFragment(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token')?.trim();
  if (!token) return;
  useWebAccessStore.getState().setToken(token);
  params.delete('token');
  const rest = params.toString();
  const url = `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`;
  window.history.replaceState(window.history.state, '', url);
}
