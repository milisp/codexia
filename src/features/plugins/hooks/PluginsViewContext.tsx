import { createContext, useContext, type ReactNode } from 'react';
import { usePluginsView } from './usePluginsView';

type PluginsViewContextValue = ReturnType<typeof usePluginsView>;

const PluginsViewContext = createContext<PluginsViewContextValue | null>(null);

/** Provides the shared PluginsView state to Header / Content / BottomBar. */
export function PluginsViewProvider({ children }: { children: ReactNode }) {
  const value = usePluginsView();
  return <PluginsViewContext.Provider value={value}>{children}</PluginsViewContext.Provider>;
}

/** Access the shared PluginsView state. Must be used within PluginsViewProvider. */
export function usePluginsViewContext() {
  const ctx = useContext(PluginsViewContext);
  if (!ctx) {
    throw new Error('usePluginsViewContext must be used within a PluginsViewProvider');
  }
  return ctx;
}
