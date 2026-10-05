import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { McpServerConfig } from '@/components/codex/types';
import { Button } from '@/components/ui/button';
import { McpServerForm } from '@/features/mcp/McpServerForm';
import { ccMcpAdd, unifiedAddMcpServer } from '@/services';
import { addKekeMcpServer } from '@/services/apiAdapt/kekeMcp';
import { useAgentSettingsStore, useWorkspaceStore } from '@/stores';

interface McpAddPanelProps {
  onAdded: () => void;
  target?: 'keke';
}

export function McpAddPanel({ onAdded, target }: McpAddPanelProps) {
  const { selectedAgent } = useAgentSettingsStore();
  const { cwd } = useWorkspaceStore();
  const [serverName, setServerName] = useState('');
  const [protocol, setProtocol] = useState<'stdio' | 'http' | 'sse'>(
    target === 'keke' ? 'http' : 'stdio'
  );
  const [commandConfig, setCommandConfig] = useState({ command: '', args: '', env: '' });
  const [httpConfig, setHttpConfig] = useState({ url: '', headers: '' });
  const [adding, setAdding] = useState(false);

  const resetForm = () => {
    setServerName('');
    setProtocol(target === 'keke' ? 'http' : 'stdio');
    setCommandConfig({ command: '', args: '', env: '' });
    setHttpConfig({ url: '', headers: '' });
  };

  const parseEnv = (raw: string): Record<string, string> | null => {
    try {
      const value = JSON.parse(raw);
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.values(value).some((item) => typeof item !== 'string')
      )
        throw new Error('Invalid map');
      return value;
    } catch {
      toast.error('Enter a JSON object with string values.');
      return null;
    }
  };

  const splitArgs = (raw: string) => raw.split(' ').filter((a) => a.trim());

  const handleAdd = async () => {
    if (!serverName.trim() || adding) return;
    setAdding(true);
    try {
      if (target === 'keke' || selectedAgent === 'codex') {
        let config: McpServerConfig & { headers?: Record<string, string> };
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
          config = { type: protocol, url: httpConfig.url.trim() };
          if (httpConfig.headers.trim()) {
            const headers = parseEnv(httpConfig.headers);
            if (!headers) return;
            config.headers = headers;
          }
        }
        if (target === 'keke') await addKekeMcpServer(serverName.trim(), config);
        else await unifiedAddMcpServer({ clientName: 'codex', serverName, serverConfig: config });
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
          if (httpConfig.headers.trim()) {
            const headers = parseEnv(httpConfig.headers);
            if (!headers) return;
            request.headers = headers;
          }
        }
        await ccMcpAdd(request, cwd || '');
      }
      toast.success(`Server "${serverName}" added`);
      resetForm();
      onAdded();
    } catch (error) {
      toast.error('Failed to add MCP server: ' + error);
    } finally {
      setAdding(false);
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
        httpConfig={target === 'keke' ? httpConfig : { url: httpConfig.url }}
        onHttpConfigChange={(config) =>
          setHttpConfig({ url: config.url, headers: config.headers ?? '' })
        }
      />
      <Button onClick={handleAdd} disabled={isDisabled || adding} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {adding ? 'Adding…' : 'Add Server'}
      </Button>
    </div>
  );
}
