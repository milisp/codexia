import React, { ReactNode, useEffect } from 'react';
import { useThemeStore, type Accent } from '@/stores/settings/ThemeStore';

interface ThemeContextType {
  theme: 'light' | 'dark';
  accent: Accent;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setAccent: (accent: Accent) => void;
}

export type { Accent };

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, accent, toggleTheme, setTheme, setAccent } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;

    // Classes to cleanup
    const themes = ['light', 'dark'];
    const accents = ['accent-black', 'accent-pink', 'accent-blue', 'accent-green', 'accent-purple', 'accent-orange'];

    // Handle dark/light mode
    root.classList.remove(...themes);
    root.classList.add(theme);

    // Handle accent color
    root.classList.remove(...accents);
    root.classList.add(`accent-${accent}`);

    // Apply color-scheme for browser UI elements (affects scrollbars, etc)
    root.style.setProperty('color-scheme', theme);
  }, [theme, accent]);

  const value: ThemeContextType = {
    theme,
    accent,
    toggleTheme,
    setTheme,
    setAccent,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextType {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}
