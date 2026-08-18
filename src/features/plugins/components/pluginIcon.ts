import { convertFileSrc } from '@tauri-apps/api/core';
import type { PluginSummary } from '@/bindings/v2';

/** Prefer logo over composerIcon, and local files over catalog URLs. */
export function pluginIconSrc(plugin: PluginSummary): string | null {
  const iface = plugin.interface;
  if (!iface) return null;

  if (iface.logo) return convertFileSrc(iface.logo);
  if (iface.composerIcon) return convertFileSrc(iface.composerIcon);
  return iface.logoUrl ?? iface.composerIconUrl ?? null;
}
