import React, { type ReactNode, useEffect, useState } from 'react';
import { type Accent, type Theme, useThemeStore } from '@/stores/settings/useThemeStore';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  accent: Accent;
  starfield: boolean;
  backgroundImage: string | null;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  setStarfield: (starfield: boolean) => void;
  setBackgroundImage: (backgroundImage: string | null) => void;
}

export type { Accent, Theme };

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const {
    theme,
    accent,
    starfield,
    backgroundImage,
    toggleTheme,
    setTheme,
    setAccent,
    setStarfield,
    setBackgroundImage,
  } = useThemeStore();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();

    const handler = () => updateResolvedTheme();
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;

    // Classes to cleanup
    const themes = ['light', 'dark'];
    const accents = [
      'accent-black',
      'accent-pink',
      'accent-blue',
      'accent-green',
      'accent-purple',
      'accent-orange',
    ];

    // Handle dark/light mode
    root.classList.remove(...themes);
    root.classList.add(resolvedTheme);

    // Handle accent color
    root.classList.remove(...accents);
    root.classList.add(`accent-${accent}`);

    // Apply color-scheme for browser UI elements (affects scrollbars, etc)
    root.style.setProperty('color-scheme', resolvedTheme);

    // Starfield effect toggle
    root.classList.toggle('starfield', starfield);
  }, [resolvedTheme, accent, starfield]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (backgroundImage) {
      root.style.setProperty('--custom-background-image', `url("${backgroundImage}")`);
      root.classList.add('has-custom-background');
    } else {
      root.style.removeProperty('--custom-background-image');
      root.classList.remove('has-custom-background');
    }
  }, [backgroundImage]);

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    accent,
    starfield,
    backgroundImage,
    toggleTheme,
    setTheme,
    setAccent,
    setStarfield,
    setBackgroundImage,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextType {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}
