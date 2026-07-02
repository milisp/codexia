import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ccMcpAdd } from '@/services';
import type { ClaudeCodeMcpServer } from '@/types/cc/cc-mcp';
import { McpServerFormFields } from './McpServerFormFields';

type ServerType = 'stdio' | 'http' | 'sse';

interface McpAddServerFormProps {
  workingDir: string;
  existingServers: ClaudeCodeMcpServer[];
  onServerAdded: () => void;
  onCancel?: () => void;
}

export function McpAddServerForm({
  workingDir,
  existingServers,
  onServerAdded,
  onCancel,
}: McpAddServerFormProps) {
  const [newServerName, setNewServerName] = useState('');
  const [newServerType, setNewServerType] = useState<ServerType>('stdio');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newEnv, setNewEnv] = useState('');

  const handleAddServer = async () => {
    if (!newServerName.trim()) {
      toast.error('Server name is required');
      return;
    }

    if (existingServers.some((s) => s.name === newServerName)) {
      toast.error('Server name already exists');
      return;
    }

    const request: any = {
      name: newServerName,
      type: newServerType,
      scope: 'local', // Default to local when adding from UI
    };

    try {
      if (newServerType === 'stdio') {
        if (!newCommand.trim()) {
          toast.error('Command is required for stdio servers');
          return;
        }

        request.command = newCommand;
        request.args = newArgs ? newArgs.split(' ').filter((a) => a.trim()) : undefined;

        if (newEnv.trim()) {
          request.env = JSON.parse(newEnv);
        }
      } else {
        if (!newUrl.trim()) {
          toast.error('URL is required for HTTP/SSE servers');
          return;
        }

        request.url = newUrl;
      }

      await ccMcpAdd(request, workingDir);

      // Reset form and refresh
      setNewServerName('');
      setNewCommand('');
      setNewArgs('');
      setNewUrl('');
      setNewEnv('');
      onServerAdded();
      toast.success(`Server "${newServerName}" added successfully`);
    } catch (error) {
      toast.error('Failed to add server or invalid environment JSON format');
    }
  };

  return (
    <Card className="p-4 max-w-2xl">
      <div className="space-y-3">
        <McpServerFormFields
          serverType={newServerType}
          name={newServerName}
          onNameChange={setNewServerName}
          command={newCommand}
          onCommandChange={setNewCommand}
          args={newArgs}
          onArgsChange={setNewArgs}
          url={newUrl}
          onUrlChange={setNewUrl}
          env={newEnv}
          onEnvChange={setNewEnv}
          onTypeChange={setNewServerType}
        />

        <div className="flex gap-2">
          <Button
            onClick={handleAddServer}
            className="flex-1"
            disabled={
              !newServerName.trim() ||
              (newServerType === 'stdio' ? !newCommand.trim() : !newUrl.trim())
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </Button>
          {onCancel && (
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
