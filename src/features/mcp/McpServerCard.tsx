import { listen } from '@tauri-apps/api/event';
import { Edit, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { McpAuthStatus, McpServerOauthLoginCompletedNotification } from '@/bindings/v2';
import type { McpServerConfig } from '@/components/codex/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';
import { isTauri } from '@/hooks/runtime';
import {
  mcpServerOauthLogin,
  unifiedDisableMcpServer,
  unifiedEnableMcpServer,
  unifiedRemoveMcpServer,
} from '@/services';

const AUTH_STATUS_LABEL: Record<McpAuthStatus, string> = {
  unsupported: 'No auth',
  notLoggedIn: 'Not logged in',
  bearerToken: 'Token',
  oAuth: 'OAuth',
};

export const getServerProtocol = (config: McpServerConfig): 'stdio' | 'http' | 'sse' =>
  config.type ?? 'stdio';

interface McpServerCardProps {
  name: string;
  config: McpServerConfig;
  loadServers: () => Promise<void>;
  setServers: Dispatch<SetStateAction<Record<string, McpServerConfig>>>;
  onEdit: (name: string, config: McpServerConfig) => void;
  authStatus?: McpAuthStatus;
  onAuthChanged?: () => void;
}

export function McpServerCard({
  name,
  config,
  loadServers,
  setServers,
  onEdit,
  authStatus,
  onAuthChanged,
}: McpServerCardProps) {
  const serverType = getServerProtocol(config);
  const isEnabled = config.enabled ?? true;
  const { openExternalUrl } = useExternalUrl();
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  // stdio servers run locally and never go through OAuth.
  const supportsAuth = serverType !== 'stdio';
  const needsAuth = supportsAuth && authStatus === 'notLoggedIn';

  useEffect(() => {
    if (!isAuthorizing || !isTauri()) {
      return;
    }

    const unlistenPromise = listen<ServerNotification>('codex:notification', (event) => {
      const { method, params } = event.payload;
      if (method !== 'mcpServer/oauthLogin/completed') {
        return;
      }
      const payload = params as McpServerOauthLoginCompletedNotification;
      if (payload.name !== name) {
        return;
      }
      setIsAuthorizing(false);
      if (payload.success) {
        toast.success(`Authorized "${name}"`);
      } else {
        toast.error(`Authorization failed: ${payload.error ?? 'unknown error'}`);
      }
      onAuthChanged?.();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [isAuthorizing, name, onAuthChanged]);

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    try {
      const response = await mcpServerOauthLogin({
        name,
        threadId: null,
        scopes: null,
        timeoutSecs: null,
      });
      await openExternalUrl(response.authorizationUrl);
      toast.info('Complete the authorization in your browser');
    } catch (error) {
      setIsAuthorizing(false);
      toast.error('Failed to start authorization: ' + error);
    }
  };

  const handleDeleteServer = async () => {
    try {
      await unifiedRemoveMcpServer({ clientName: 'codex', serverName: name });
      await loadServers();
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
      toast.error('Failed to delete MCP server: ' + error);
    }
  };

  const handleToggleServerEnabled = async (enabled: boolean) => {
    try {
      if (enabled) {
        await unifiedEnableMcpServer({ clientName: 'codex', serverName: name });
      } else {
        await unifiedDisableMcpServer({ clientName: 'codex', serverName: name });
      }
      setServers((prev) => {
        const server = prev[name];
        if (!server) {
          return prev;
        }
        return {
          ...prev,
          [name]: {
            ...server,
            enabled,
          },
        };
      });
    } catch (error) {
      console.error('Failed to update MCP server enabled flag:', error);
      toast.error('Failed to update MCP server enabled flag: ' + error);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            {name}
            {supportsAuth && authStatus && (
              <Badge
                variant="outline"
                className={`text-[10px] font-normal px-1.5 h-4 uppercase ${
                  authStatus === 'notLoggedIn'
                    ? 'bg-red-500/10 text-red-500'
                    : authStatus === 'unsupported'
                      ? 'text-muted-foreground'
                      : 'bg-green-500/10 text-green-500'
                }`}
              >
                {AUTH_STATUS_LABEL[authStatus]}
              </Badge>
            )}
          </span>
          <div className="flex gap-1 items-center">
            {needsAuth && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAuthorize}
                disabled={isAuthorizing}
                className="h-7 text-xs"
              >
                {isAuthorizing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                )}
                Authorize
              </Button>
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => handleToggleServerEnabled(checked)}
              aria-label={`Toggle ${name} server`}
            />
            <Button size="sm" variant="ghost" onClick={() => onEdit(name, config)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDeleteServer}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-600">
          {serverType === 'stdio' && (
            <div>
              <strong>Command:</strong> {'command' in config ? config.command : ''}
              {'args' in config && config.args && config.args.length > 0 && (
                <div>
                  <strong>Args:</strong> {config.args.join(' ')}
                </div>
              )}
              {'env' in config && config.env && (
                <div>
                  <strong>Env:</strong> {Object.keys(config.env).join(', ')}
                </div>
              )}
            </div>
          )}
          {serverType === 'http' && 'url' in config && (
            <div>
              <strong>url:</strong> {config.url}
            </div>
          )}
          {serverType === 'sse' && 'url' in config && (
            <div>
              <strong>url:</strong> {config.url}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
