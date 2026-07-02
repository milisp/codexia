import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WebviewState = {
  history: string[];
  index: number;
  addUrl: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
};

export const useWebviewStore = create<WebviewState>()(
  persist(
    (set, get) => ({
      history: [],
      index: -1,

      addUrl: (url) => {
        const { history, index } = get();
        // If the url is the same as the current, do nothing
        if (history[index] === url) {
          return;
        }

        // Remove forward history
        const newHistory = history.slice(0, index + 1);
        newHistory.push(url);

        // If we exceed 5, remove the oldest
        if (newHistory.length > 5) {
          newHistory.shift();
        }

        // Set the new history and set index to the last element
        set({
          history: newHistory,
          index: newHistory.length - 1,
        });
      },

      goBack: () => {
        const { index } = get();
        if (index > 0) {
          set((state) => ({ index: state.index - 1 }));
        }
      },

      goForward: () => {
        const { history, index } = get();
        if (index < history.length - 1) {
          set((state) => ({ index: state.index + 1 }));
        }
      },
    }),
    { name: 'webview-store' }
  )
);
