import { Edit, Power, PowerOff, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ccMcpAdd, ccMcpDisable, ccMcpEnable, ccMcpRemove } from '@/services';
import type { ClaudeCodeMcpServer } from '@/types/cc/cc-mcp';
import { McpServerFormFields } from './McpServerFormFields';

type ServerType = 'stdio' | 'http' | 'sse';

interface McpServerCardProps {
  server: ClaudeCodeMcpServer;
  workingDir: string;
  onServerUpdated: () => void;
}

export function McpServerCard({ server, workingDir, onServerUpdated }: McpServerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(server.name);
  const [editType, setEditType] = useState<ServerType>((server.type || 'stdio') as ServerType);
  const [editCommand, setEditCommand] = useState(server.command || '');
  const [editArgs, setEditArgs] = useState(server.args ? server.args.join(' ') : '');
  const [editUrl, setEditUrl] = useState(server.url || '');
  const [editEnv, setEditEnv] = useState(server.env ? JSON.stringify(server.env, null, 2) : '');

  const handleEditClick = () => {
    setIsEditing(true);
    setEditName(server.name);
    const type = server.type || 'stdio';
    setEditType(type as ServerType);

    if (type === 'stdio') {
      setEditCommand(server.command || '');
      setEditArgs(server.args ? server.args.join(' ') : '');
      setEditEnv(server.env ? JSON.stringify(server.env, null, 2) : '');
      setEditUrl('');
    } else {
      setEditUrl(server.url || '');
      setEditCommand('');
      setEditArgs('');
      setEditEnv('');
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Server name is required');
      return;
    }

    const request: any = {
      name: editName,
      type: editType,
      scope: 'local',
    };

    try {
      if (editType === 'stdio') {
        if (!editCommand.trim()) {
          toast.error('Command is required for stdio servers');
          return;
        }

        request.command = editCommand;
        request.args = editArgs ? editArgs.split(' ').filter((a) => a.trim()) : undefined;

        if (editEnv.trim()) {
          request.env = JSON.parse(editEnv);
        }
      } else {
        if (!editUrl.trim()) {
          toast.error('URL is required for HTTP/SSE servers');
          return;
        }

        request.url = editUrl;
      }

      if (server.name !== editName) {
        await ccMcpRemove(server.name, workingDir, server.scope);
      }

      await ccMcpAdd(request, workingDir);

      setIsEditing(false);
      onServerUpdated();
      toast.success(`Server "${editName}" updated successfully`);
    } catch (error) {
      toast.error('Failed to update server or invalid environment JSON format');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDeleteServer = async () => {
    try {
      await ccMcpRemove(server.name, workingDir, server.scope);
      onServerUpdated();
      toast.success(`Server "${server.name}" deleted`);
    } catch (error) {
      toast.error(`Failed to delete server: ${error}`);
    }
  };

  const handleToggleServer = async () => {
    try {
      if (server.enabled === false) {
        await ccMcpEnable(server.name, workingDir);
      } else {
        await ccMcpDisable(server.name, workingDir);
      }
      onServerUpdated();
      toast.success(`Server "${server.name}" ${server.enabled === false ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error(`Failed to toggle server: ${error}`);
    }
  };

  return (
    <Card className={`p-4 ${server.enabled === false ? 'opacity-60' : ''}`}>
      {isEditing ? (
        <div className="space-y-3">
          <McpServerFormFields
            serverType={editType}
            name={editName}
            onNameChange={setEditName}
            command={editCommand}
            onCommandChange={setEditCommand}
            args={editArgs}
            onArgsChange={setEditArgs}
            url={editUrl}
            onUrlChange={setEditUrl}
            env={editEnv}
            onEnvChange={setEditEnv}
            onTypeChange={setEditType}
            envLabel="Environment (JSON)"
          />

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit}>
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-medium">{server.name}</span>
              <Badge variant="secondary" className="text-[10px] font-normal px-1.5 h-4 uppercase">
                {server.type}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] font-normal px-1.5 h-4 uppercase ${
                  server.scope === 'global'
                    ? 'bg-blue-500/10 text-blue-500'
                    : server.scope === 'project'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-orange-500/10 text-orange-500'
                }`}
              >
                {server.scope}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono line-clamp-1">
              {server.type === 'stdio'
                ? `${server.command || ''} ${server.args?.join(' ') || ''}`
                : server.url || ''}
            </p>
            {server.env && Object.keys(server.env).length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Env: {Object.keys(server.env).length} variable(s)
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleToggleServer}
              className="h-7 w-7"
              title={server.enabled === false ? 'Enable' : 'Disable'}
            >
              {server.enabled === false ? (
                <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Power className="h-3.5 w-3.5 text-green-500" />
              )}
            </Button>
            <Button size="icon" variant="ghost" onClick={handleEditClick} className="h-7 w-7">
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDeleteServer}
              className="h-7 w-7 text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
