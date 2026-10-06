import { invoke } from '@tauri-apps/api/core';

export type KekeMcpAuthStatus = { signedIn: boolean | null; error: string | null };

export function readKekeMcpAuthStatusesTauri(): Promise<Record<string, KekeMcpAuthStatus>> {
  return invoke('keke_mcp_auth_statuses');
}

export function loginKekeMcpServerTauri(name: string): Promise<void> {
  return invoke('keke_mcp_login', { name });
}

export function authorizeGitHubMcpTauri(name: string, token: string): Promise<void> {
  return invoke('keke_mcp_authorize_github', { name, token });
}
