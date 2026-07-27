// src/features/plugins/hooks/PluginsViewContext.tsx
import { createContext, type ReactNode } from 'react';
import { usePluginsView } from './usePluginsView';

type PluginsViewContextValue = ReturnType<typeof usePluginsView>;

// Export context so the hook file can import it
export const PluginsViewContext = createContext<PluginsViewContextValue | null>(null);

/** Provides the shared PluginsView state to Header / Content / BottomBar. */
export function PluginsViewProvider({ children }: { children: ReactNode }) {
  const value = usePluginsView();
  return <PluginsViewContext.Provider value={value}>{children}</PluginsViewContext.Provider>;
}
