import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CCMcpServerConfig, CCMcpServers } from '@/types/cc/cc-mcp';

interface CCMCPManagerProps {
  servers: CCMcpServers;
  onChange: (servers: CCMcpServers) => void;
}

type ServerType = 'stdio' | 'http' | 'sse';

export function CCMCPManager({ servers, onChange }: CCMCPManagerProps) {
  const [newServerName, setNewServerName] = useState('');
  const [newServerType, setNewServerType] = useState<ServerType>('stdio');
  const [newCommand, setNewCommand] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newArgs, setNewArgs] = useState('');

  const handleAddServer = () => {
    if (!newServerName.trim()) return;

    let config: CCMcpServerConfig;

    if (newServerType === 'stdio') {
      if (!newCommand.trim()) return;
      config = {
        type: 'stdio',
        command: newCommand,
        args: newArgs ? newArgs.split(' ').filter((a) => a) : undefined,
      };
    } else {
      if (!newUrl.trim()) return;
      config = {
        type: newServerType,
        url: newUrl,
      };
    }

    onChange({
      ...servers,
      [newServerName]: config,
    });

    // Reset form
    setNewServerName('');
    setNewCommand('');
    setNewUrl('');
    setNewArgs('');
  };

  const handleRemoveServer = (name: string) => {
    const updated = { ...servers };
    delete updated[name];
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">MCP Servers</h3>

        {Object.keys(servers).length === 0 ? (
          <p className="text-xs text-muted-foreground">No MCP servers configured</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(servers).map(([name, config]) => (
              <div key={name} className="flex items-center gap-2 p-2 border rounded">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium">{name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                      {config.type || 'stdio'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {config.type === 'stdio' || !config.type
                      ? `${'command' in config ? config.command : ''} ${'args' in config ? (config.args || []).join(' ') : ''}`
                      : 'url' in config
                        ? config.url
                        : ''}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveServer(name)}
                  className="h-7 w-7"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 pt-3 border-t">
        <h4 className="text-xs font-medium">Add New Server</h4>

        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Server Name</Label>
            <Input
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              placeholder="my-server"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={newServerType} onValueChange={(v) => setNewServerType(v as ServerType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">Stdio</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newServerType === 'stdio' ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Command</Label>
                <Input
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="node"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Arguments (space-separated)</Label>
                <Input
                  value={newArgs}
                  onChange={(e) => setNewArgs(e.target.value)}
                  placeholder="server.js --port 3000"
                  className="h-8 text-xs"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="h-8 text-xs"
              />
            </div>
          )}

          <Button
            onClick={handleAddServer}
            size="sm"
            className="w-full h-8 text-xs"
            disabled={
              !newServerName.trim() ||
              (newServerType === 'stdio' ? !newCommand.trim() : !newUrl.trim())
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Server
          </Button>
        </div>
      </div>
    </div>
  );
}
