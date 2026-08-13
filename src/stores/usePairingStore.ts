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
  desktops: PairedDesktop[];
  /**
   * Which desktop requests are addressed at.
   *
   * The MagicDNS hostname is the identity: Tailscale keeps it stable across
   * restarts, so it works as a key without minting a UUID no one ever sees.
   */
  selectedHost: string | null;
  addDesktop: (desktop: PairedDesktop) => void;
  removeDesktop: (host: string) => void;
  selectDesktop: (host: string) => void;
};

/** Shape persisted by version 1, when a phone could only hold one pairing. */
type PairingStateV1 = { desktop: PairedDesktop | null };

/**
 * Where the mobile app sends its requests.
 *
 * The desktop build talks to its own Tauri backend and never reads this; on a
 * phone there is no local backend, so every call has to be addressed at a
 * paired machine and carry its device token. A phone is expected to drive
 * several machines (laptop, desktop, work box), hence a list rather than one
 * global address.
 */
export const usePairingStore = create<PairingState>()(
  persist(
    (set) => ({
      desktops: [],
      selectedHost: null,

      addDesktop: (desktop) =>
        set((state) => ({
          // Re-pairing a known host replaces it: the token or port may have
          // changed, and two rows for one machine cannot be told apart.
          desktops: [...state.desktops.filter((d) => d.host !== desktop.host), desktop],
          selectedHost: state.selectedHost ?? desktop.host,
        })),

      removeDesktop: (host) =>
        set((state) => {
          const desktops = state.desktops.filter((d) => d.host !== host);
          const selectedHost =
            state.selectedHost === host ? (desktops[0]?.host ?? null) : state.selectedHost;
          return { desktops, selectedHost };
        }),

      selectDesktop: (host) => set({ selectedHost: host }),
    }),
    {
      name: 'codexia.pairing',
      version: 2,
      partialize: (state) => ({ desktops: state.desktops, selectedHost: state.selectedHost }),
      migrate: (persisted, version) => {
        if (version < 2) {
          const { desktop } = persisted as PairingStateV1;
          return {
            desktops: desktop ? [desktop] : [],
            selectedHost: desktop?.host ?? null,
          };
        }
        return persisted as Pick<PairingState, 'desktops' | 'selectedHost'>;
      },
    }
  )
);

/** The desktop every request is currently addressed at, or null when unpaired. */
export const pairedDesktop = (): PairedDesktop | null => {
  const { desktops, selectedHost } = usePairingStore.getState();
  return desktops.find((d) => d.host === selectedHost) ?? null;
};

/**
 * The desktop serves plain HTTP over the tailnet — see the ATS exception for
 * `ts.net` in `src-tauri/gen/apple/codexia_iOS/Info.plist`.
 */
export const desktopBaseUrl = (desktop: PairedDesktop) => `http://${desktop.host}:${desktop.port}`;
