import { Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  DefaultMcpServers,
  getServerProtocol,
  McpServerCard,
  McpServerForm,
} from '@/components/features/mcp';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { unifiedAddMcpServer, unifiedReadMcpConfig, unifiedRemoveMcpServer } from '@/services';
import type { McpServerConfig } from '@/types';

interface CodexMcpViewProps {
  refreshKey?: number;
}

export function CodexMcpView({ refreshKey }: CodexMcpViewProps) {
  const [servers, setServers] = useState<Record<string, McpServerConfig>>({});
  const [activeTab, setActiveTab] = useState('configured');
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<{
    name: string;
    protocol: 'stdio' | 'http' | 'sse';
    command: { command: string; args: string; env: string };
    http: { url: string };
  } | null>(null);

  const loadServers = async () => {
    try {
      const config = await unifiedReadMcpConfig('codex');
      setServers((config.mcpServers as Record<string, McpServerConfig> | undefined) ?? {});
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  };

  useEffect(() => {
    loadServers();
  }, [refreshKey]);

  const handleEditServer = (name: string, config: McpServerConfig) => {
    const protocol = getServerProtocol(config);
    const httpUrl = protocol === 'stdio' ? '' : 'url' in config ? config.url : '';
    setEditingServer(name);
    setEditConfig({
      name,
      protocol,
      command: {
        command: protocol === 'stdio' && 'command' in config ? config.command : '',
        args: protocol === 'stdio' && 'args' in config ? config.args.join(' ') : '',
        env:
          protocol === 'stdio' && 'env' in config && config.env
            ? JSON.stringify(config.env, null, 2)
            : '',
      },
      http: {
        url: httpUrl,
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editConfig || !editingServer) return;

    try {
      let config: McpServerConfig;

      if (editConfig.protocol === 'stdio') {
        config = {
          type: 'stdio',
          command: editConfig.command.command,
          args: editConfig.command.args.split(' ').filter((arg) => arg.trim()),
        };

        if (editConfig.command.env && editConfig.command.env.trim()) {
          try {
            config.env = JSON.parse(editConfig.command.env);
          } catch (e) {
            toast.error('Invalid JSON format for environment variables');
            return;
          }
        }
      } else {
        config = {
          type: editConfig.protocol,
          url: editConfig.http.url,
        };
      }

      await unifiedRemoveMcpServer({
        clientName: 'codex',
        serverName: editingServer,
      });
      await unifiedAddMcpServer({
        clientName: 'codex',
        serverName: editConfig.name,
        serverConfig: config,
      });

      setEditingServer(null);
      setEditConfig(null);
      loadServers();
    } catch (error) {
      console.error('Failed to update MCP server:', error);
      toast.error('Failed to update MCP server: ' + error);
    }
  };

  const handleCancelEdit = () => {
    setEditingServer(null);
    setEditConfig(null);
  };

  return (
    <div className="container mx-auto">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="configured">Configured</TabsTrigger>
            <TabsTrigger value="quick">Quick</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-6">
            <DefaultMcpServers servers={servers} onServerAdded={loadServers} />
          </TabsContent>

          <TabsContent value="configured" className="mt-6">
            <div className="space-y-2">
              {Object.entries(servers).map(([name, config]) => (
                <div key={name}>
                  {editingServer === name ? (
                    <div className="px-4">
                      <div className="space-y-4">
                        <McpServerForm
                          serverName={editConfig?.name ?? ''}
                          onServerNameChange={(name) =>
                            setEditConfig((prev) => (prev ? { ...prev, name } : null))
                          }
                          protocol={editConfig?.protocol ?? 'stdio'}
                          onProtocolChange={(protocol) =>
                            setEditConfig((prev) => (prev ? { ...prev, protocol } : null))
                          }
                          commandConfig={
                            editConfig?.command ?? {
                              command: '',
                              args: '',
                              env: '',
                            }
                          }
                          onCommandConfigChange={(command) =>
                            setEditConfig((prev) => (prev ? { ...prev, command } : null))
                          }
                          httpConfig={editConfig?.http ?? { url: '' }}
                          onHttpConfigChange={(http) =>
                            setEditConfig((prev) => (prev ? { ...prev, http } : null))
                          }
                          isEditMode={true}
                        />

                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <McpServerCard
                      name={name}
                      config={config}
                      loadServers={loadServers}
                      setServers={setServers}
                      onEdit={handleEditServer}
                    />
                  )}
                </div>
              ))}
              {Object.keys(servers).length === 0 && (
                <div className="text-gray-500 text-center py-8">No MCP servers configured</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
