import { dual, dualVoid, type UnifiedMcpClientName, type UnifiedMcpConfig } from './shared';

export async function unifiedReadMcpConfig(
  clientName: UnifiedMcpClientName,
  path?: string
): Promise<UnifiedMcpConfig> {
  return await dual<UnifiedMcpConfig>(
    'unified_read_mcp_config',
    { clientName, path },
    '/api/codex/mcp/read',
    { client_name: clientName, path }
  );
}

export async function unifiedAddMcpServer(params: {
  clientName: UnifiedMcpClientName;
  path?: string;
  serverName: string;
  serverConfig: unknown;
  scope?: string;
}) {
  await dualVoid('unified_add_mcp_server', params, '/api/codex/mcp/add', {
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
  await dualVoid('unified_remove_mcp_server', params, '/api/codex/mcp/remove', {
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
  await dualVoid('unified_enable_mcp_server', params, '/api/codex/mcp/enable', {
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
  await dualVoid('unified_disable_mcp_server', params, '/api/codex/mcp/disable', {
    client_name: params.clientName,
    path: params.path,
    server_name: params.serverName,
  });
}
