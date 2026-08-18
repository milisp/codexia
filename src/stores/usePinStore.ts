import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PinnedItem {
  kind: 'codex' | 'cc';
  id: string;
  title: string;
  cwd: string;
}

interface PinStore {
  pinned: PinnedItem[];
  isPinned: (id: string) => boolean;
  togglePin: (item: PinnedItem) => void;
  unpin: (id: string) => void;
}

export const usePinStore = create<PinStore>()(
  persist(
    (set, get) => ({
      pinned: [],
      isPinned: (id) => get().pinned.some((p) => p.id === id),
      togglePin: (item) =>
        set((state) =>
          state.pinned.some((p) => p.id === item.id)
            ? { pinned: state.pinned.filter((p) => p.id !== item.id) }
            : { pinned: [item, ...state.pinned] }
        ),
      unpin: (id) => set((state) => ({ pinned: state.pinned.filter((p) => p.id !== id) })),
    }),
    { name: 'pin-storage', version: 1 }
  )
);
