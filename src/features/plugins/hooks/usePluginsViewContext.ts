// src/features/plugins/hooks/usePluginsViewContext.ts
import { useContext } from 'react';
import { PluginsViewContext } from './PluginsViewContext';

/** Access the shared PluginsView state. Must be used within PluginsViewProvider. */
export function usePluginsViewContext() {
  const ctx = useContext(PluginsViewContext);
  if (!ctx) {
    throw new Error('usePluginsViewContext must be used within a PluginsViewProvider');
  }
  return ctx;
}
