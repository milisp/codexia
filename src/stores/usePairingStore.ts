import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** A desktop this device has been paired with. */
export type PairedDesktop = {
  name: string;
  host: string;
  port: number;
  token: string;
};

type PairingState = {
  desktop: PairedDesktop | null;
  setDesktop: (desktop: PairedDesktop) => void;
  clearDesktop: () => void;
};

/**
 * Where the mobile app sends its requests.
 *
 * The desktop build talks to its own Tauri backend and never reads this; on a
 * phone there is no local backend, so every call has to be addressed at a
 * paired machine and carry its device token.
 */
export const usePairingStore = create<PairingState>()(
  persist(
    (set) => ({
      desktop: null,
      setDesktop: (desktop) => set({ desktop }),
      clearDesktop: () => set({ desktop: null }),
    }),
    {
      name: 'codexia.pairing',
      version: 1,
      partialize: (state) => ({ desktop: state.desktop }),
    }
  )
);

export const pairedDesktop = () => usePairingStore.getState().desktop;

/**
 * The desktop serves plain HTTP over the tailnet — see the ATS exception for
 * `ts.net` in `src-tauri/gen/apple/codexia_iOS/Info.plist`.
 */
export const desktopBaseUrl = (desktop: PairedDesktop) => `http://${desktop.host}:${desktop.port}`;
