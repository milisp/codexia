import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentCenterCard =
  | { kind: 'codex'; id: string; preview?: string; worktreePath?: string }
  | { kind: 'cc'; id: string; preview?: string; worktreePath?: string };

interface AgentCenterState {
  cards: AgentCenterCard[];
  addAgentCard: (card: AgentCenterCard) => boolean;
  removeCard: (card: AgentCenterCard) => void;
  updateCard: (card: AgentCenterCard) => void;
  currentAgentCardId: string | null;
  setCurrentAgentCardId: (id: string | null) => void;
}

export const useAgentCenterStore = create<AgentCenterState>()(
  persist(
    (set) => ({
      cards: [],

      // Returns true if the card was added/updated.
      addAgentCard: (card) => {
        let added = false;
        set((state) => {
          const idx = state.cards.findIndex((c) => c.kind === card.kind && c.id === card.id);
          // Update existing card metadata without dropping a saved worktree path.
          if (idx !== -1) {
            const next = [...state.cards];
            next[idx] = { ...next[idx], ...card } as AgentCenterCard;
            added = true;
            return { cards: next };
          }
          added = true;
          return { cards: [card, ...state.cards] };
        });
        return added;
      },

      removeCard: (card) =>
        set((state) => ({
          cards: state.cards.filter((c) => !(c.kind === card.kind && c.id === card.id)),
        })),

      updateCard: (card) =>
        set((state) => ({
          cards: state.cards.map((existing) =>
            existing.kind === card.kind && existing.id === card.id
              ? ({ ...existing, ...card } as AgentCenterCard)
              : existing
          ),
        })),

      currentAgentCardId: null,
      setCurrentAgentCardId: (id) => set({ currentAgentCardId: id }),
    }),
    {
      name: 'agent-center-store',
      version: 1,
      // currentAgentCardId is runtime-only — not persisted
      partialize: (state) => ({
        cards: state.cards,
      }),
    }
  )
);
