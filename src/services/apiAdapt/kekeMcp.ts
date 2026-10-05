import { invoke } from '@tauri-apps/api/core';
import { isDesktopTauri } from '@/hooks/runtime';
import {
  type KekeMcpAuthStatus,
  loginKekeMcpServerTauri,
  readKekeMcpAuthStatusesTauri,
} from '@/services/tauri/kekeMcp';
import { postJson } from './shared';

export type { KekeMcpAuthStatus } from '@/services/tauri/kekeMcp';

export type KekeMcpServer = {
  type?: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
  [key: string]: unknown;
};

/** Store this qualified selection in Bot.mcpServers; bare names are legacy. */
export function kekeMcpSelection(name: string): string {
  return `keke:${name}`;
}

export async function readKekeMcpServers(): Promise<Record<string, KekeMcpServer>> {
  return isDesktopTauri() ? invoke('keke_read_mcp_servers') : postJson('/api/keke/mcp/read', {});
}

export async function addKekeMcpServer(name: string, config: KekeMcpServer): Promise<void> {
  if (isDesktopTauri()) await invoke('keke_add_mcp_server', { name, config });
  else await postJson('/api/keke/mcp/add', { name, config });
}

export async function removeKekeMcpServer(name: string): Promise<void> {
  if (isDesktopTauri()) await invoke('keke_remove_mcp_server', { name });
  else await postJson('/api/keke/mcp/remove', { name });
}

export async function readKekeMcpAuthStatuses(): Promise<Record<string, KekeMcpAuthStatus>> {
  return isDesktopTauri()
    ? readKekeMcpAuthStatusesTauri()
    : postJson('/api/keke/mcp/auth-statuses', {});
}

export async function loginKekeMcpServer(name: string): Promise<void> {
  if (isDesktopTauri()) await loginKekeMcpServerTauri(name);
  else await postJson('/api/keke/mcp/login', { name });
}
