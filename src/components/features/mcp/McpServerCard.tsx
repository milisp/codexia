import { Edit, Trash2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  unifiedDisableMcpServer,
  unifiedEnableMcpServer,
  unifiedRemoveMcpServer,
} from '@/services';
import type { McpServerConfig } from '@/types';

export const getServerProtocol = (config: McpServerConfig): 'stdio' | 'http' | 'sse' =>
  config.type ?? 'stdio';

interface McpServerCardProps {
  name: string;
  config: McpServerConfig;
  loadServers: () => Promise<void>;
  setServers: Dispatch<SetStateAction<Record<string, McpServerConfig>>>;
  onEdit: (name: string, config: McpServerConfig) => void;
}

export function McpServerCard({
  name,
  config,
  loadServers,
  setServers,
  onEdit,
}: McpServerCardProps) {
  const serverType = getServerProtocol(config);
  const isEnabled = config.enabled ?? true;

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
          {name}
          <div className="flex gap-1 items-center">
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
