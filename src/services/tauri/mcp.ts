import {
  invokeTauri,
  isDesktopTauri,
  postJson,
  postNoContent,
  type UnifiedMcpClientName,
  type UnifiedMcpConfig,
} from './shared';

export async function unifiedReadMcpConfig(
  clientName: UnifiedMcpClientName,
  path?: string
): Promise<UnifiedMcpConfig> {
  if (isDesktopTauri()) {
    return await invokeTauri<UnifiedMcpConfig>('unified_read_mcp_config', { clientName, path });
  }
  return await postJson<UnifiedMcpConfig>('/api/codex/mcp/read', { client_name: clientName, path });
}

export async function unifiedAddMcpServer(params: {
  clientName: UnifiedMcpClientName;
  path?: string;
  serverName: string;
  serverConfig: unknown;
  scope?: string;
}) {
  if (isDesktopTauri()) {
    await invokeTauri('unified_add_mcp_server', params);
    return;
  }
  await postNoContent('/api/codex/mcp/add', {
    client_name: params.clientName,
    path: params.path,
    server_name: params.serverName,
    server_config: params.serverConfig,
    scope: params.scope,
  });
}

export async function unifiedRemoveMcpServer(params: {
  clientName: UnifiedMcpClientName;
  path?: string;
  serverName: string;
  scope?: string;
}) {
  if (isDesktopTauri()) {
    await invokeTauri('unified_remove_mcp_server', params);
    return;
  }
  await postNoContent('/api/codex/mcp/remove', {
    client_name: params.clientName,
    path: params.path,
    server_name: params.serverName,
    scope: params.scope,
  });
}

export async function unifiedEnableMcpServer(params: {
  clientName: UnifiedMcpClientName;
  path?: string;
  serverName: string;
}) {
  if (isDesktopTauri()) {
    await invokeTauri('unified_enable_mcp_server', params);
    return;
  }
  await postNoContent('/api/codex/mcp/enable', {
    client_name: params.clientName,
    path: params.path,
    server_name: params.serverName,
  });
}

export async function unifiedDisableMcpServer(params: {
  clientName: UnifiedMcpClientName;
  path?: string;
  serverName: string;
}) {
  if (isDesktopTauri()) {
    await invokeTauri('unified_disable_mcp_server', params);
    return;
  }
  await postNoContent('/api/codex/mcp/disable', {
    client_name: params.clientName,
    path: params.path,
    server_name: params.serverName,
  });
}
