import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Light/dark mode
export type Theme = 'light' | 'dark' | 'system';

// Accent color theme
export type Accent = 'ghibli' | 'black' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

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
      accent: 'ghibli',
      starfield: true,
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
    }
  )
);
