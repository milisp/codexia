import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { McpServerForm } from '@/components/features/mcp/McpServerForm';
import { Button } from '@/components/ui/button';
import { ccMcpAdd, unifiedAddMcpServer } from '@/services';
import { useWorkspaceStore } from '@/stores';
import type { McpServerConfig } from '@/types';

interface McpAddPanelProps {
  onAdded: () => void;
}

export function McpAddPanel({ onAdded }: McpAddPanelProps) {
  const { selectedAgent, cwd } = useWorkspaceStore();
  const [serverName, setServerName] = useState('');
  const [protocol, setProtocol] = useState<'stdio' | 'http' | 'sse'>('stdio');
  const [commandConfig, setCommandConfig] = useState({ command: '', args: '', env: '' });
  const [httpConfig, setHttpConfig] = useState({ url: '' });

  const resetForm = () => {
    setServerName('');
    setProtocol('stdio');
    setCommandConfig({ command: '', args: '', env: '' });
    setHttpConfig({ url: '' });
  };

  const parseEnv = (raw: string): Record<string, string> | null => {
    try {
      return JSON.parse(raw);
    } catch {
      toast.error('Invalid JSON for environment variables');
      return null;
    }
  };

  const splitArgs = (raw: string) => raw.split(' ').filter((a) => a.trim());

  const handleAdd = async () => {
    if (!serverName.trim()) return;
    try {
      if (selectedAgent === 'codex') {
        let config: McpServerConfig;
        if (protocol === 'stdio') {
          config = {
            type: 'stdio',
            command: commandConfig.command,
            args: splitArgs(commandConfig.args),
          };
          if (commandConfig.env.trim()) {
            const env = parseEnv(commandConfig.env);
            if (!env) return;
            config.env = env;
          }
        } else {
          config = { type: protocol, url: httpConfig.url };
        }
        await unifiedAddMcpServer({ clientName: 'codex', serverName, serverConfig: config });
      } else {
        const request: any = { name: serverName, type: protocol, scope: 'local', enabled: true };
        if (protocol === 'stdio') {
          if (!commandConfig.command.trim()) {
            toast.error('Command is required');
            return;
          }
          request.command = commandConfig.command;
          if (commandConfig.args) request.args = splitArgs(commandConfig.args);
          if (commandConfig.env.trim()) {
            const env = parseEnv(commandConfig.env);
            if (!env) return;
            request.env = env;
          }
        } else {
          if (!httpConfig.url.trim()) {
            toast.error('URL is required');
            return;
          }
          request.url = httpConfig.url;
        }
        await ccMcpAdd(request, cwd || '');
      }
      toast.success(`Server "${serverName}" added`);
      resetForm();
      onAdded();
    } catch (error) {
      toast.error('Failed to add MCP server: ' + error);
    }
  };

  const isDisabled =
    !serverName.trim() ||
    (protocol === 'stdio' ? !commandConfig.command.trim() : !httpConfig.url.trim());

  return (
    <div className="space-y-4">
      <McpServerForm
        serverName={serverName}
        onServerNameChange={setServerName}
        protocol={protocol}
        onProtocolChange={setProtocol}
        commandConfig={commandConfig}
        onCommandConfigChange={setCommandConfig}
        httpConfig={httpConfig}
        onHttpConfigChange={setHttpConfig}
      />
      <Button onClick={handleAdd} disabled={isDisabled} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Server
      </Button>
    </div>
  );
}
