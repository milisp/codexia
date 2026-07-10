import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentCenterCard =
  | { kind: 'codex'; id: string; preview?: string; worktreePath?: string; cwd?: string | null }
  | { kind: 'cc'; id: string; preview?: string; worktreePath?: string; cwd?: string | null };

// Multi-agent view layout mode: grid of cards, compact list (header only), or solo active card.
export type AgentCardsViewMode = 'grid' | 'list' | 'solo';

// User-adjusted size for a solo card in grid mode (Ghostty-style manual resize).
// width is omitted until the user drags the right edge, letting the card fall back
// to the layout's natural flex-basis; height always has a value (defaults to h-72).
export interface AgentCardSize {
  width?: number;
  height: number;
}

interface AgentCenterState {
  cards: AgentCenterCard[];
  addAgentCard: (card: AgentCenterCard) => boolean;
  removeCard: (card: AgentCenterCard) => void;
  updateCard: (card: AgentCenterCard) => void;
  currentAgentCardId: string | null;
  setCurrentAgentCardId: (id: string | null) => void;
  cardsViewMode: AgentCardsViewMode;
  setCardsViewMode: (mode: AgentCardsViewMode) => void;
  cardSizeMap: Record<string, AgentCardSize>;
  setCardSize: (cardId: string, size: AgentCardSize) => void;
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

      cardsViewMode: 'solo',
      setCardsViewMode: (mode) => set({ cardsViewMode: mode }),

      cardSizeMap: {},
      setCardSize: (cardId, size) =>
        set((state) => ({ cardSizeMap: { ...state.cardSizeMap, [cardId]: size } })),
    }),
    {
      name: 'agent-center-store',
      version: 4,
      migrate: (persistedState: any, version: number) => {
        if (version === 3 && persistedState?.cardsViewMode === 'single') {
          persistedState.cardsViewMode = 'solo';
        }
        return persistedState;
      },
      // currentAgentCardId is runtime-only — not persisted
      partialize: (state) => ({
        cards: state.cards,
        cardsViewMode: state.cardsViewMode,
        cardSizeMap: state.cardSizeMap,
      }),
    }
  )
);
