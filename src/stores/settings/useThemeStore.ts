import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Light/dark mode
export type Theme = 'light' | 'dark' | 'system';

// Accent color theme
export type Accent =
  | 'default'
  | 'ghibli'
  | 'black'
  | 'pink'
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange';

interface ThemeState {
  theme: Theme;
  accent: Accent;
  starfield: boolean;
  backgroundImage: string | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setAccent: (accent: Accent) => void;
  setStarfield: (starfield: boolean) => void;
  setBackgroundImage: (backgroundImage: string | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      accent: 'default',
      starfield: false,
      backgroundImage: null,
      setTheme: (theme: Theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => {
          if (state.theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            return { theme: isDark ? 'light' : 'dark' };
          }
          return { theme: state.theme === 'dark' ? 'light' : 'dark' };
        }),
      setAccent: (accent: Accent) => set({ accent }),
      setStarfield: (starfield: boolean) => set({ starfield }),
      setBackgroundImage: (backgroundImage: string | null) => set({ backgroundImage }),
    }),
    {
      name: 'theme-storage',
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<ThemeState>;
        // v0 shipped the Ghibli scene as the default; most users never picked it,
        // so move them to the plain default. It stays one click away in Settings.
        if (version < 1 && state.accent === 'ghibli') {
          return { ...state, accent: 'default' } as ThemeState;
        }
        return state as ThemeState;
      },
    }
  )
);
