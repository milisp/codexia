import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentCenterCard =
  | { kind: 'codex'; id: string; preview?: string; worktreePath?: string }
  | { kind: 'cc'; id: string; preview?: string; worktreePath?: string };

interface AgentCenterState {
  cards: AgentCenterCard[];
  addAgentCard: (card: AgentCenterCard) => boolean;
  removeCard: (card: AgentCenterCard) => void;
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
          // Update preview for an existing card — never counts toward the limit.
          if (idx !== -1) {
            if (!card.preview) return {};
            const next = [...state.cards];
            next[idx] = { ...next[idx], preview: card.preview } as AgentCenterCard;
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
