import type React from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface McpServerFormProps {
  serverName: string;
  onServerNameChange: (name: string) => void;
  protocol: 'stdio' | 'http' | 'sse';
  onProtocolChange: (protocol: 'stdio' | 'http' | 'sse') => void;
  commandConfig: { command: string; args: string; env: string };
  onCommandConfigChange: (config: { command: string; args: string; env: string }) => void;
  httpConfig: { url: string; headers?: string };
  onHttpConfigChange: (config: { url: string; headers?: string }) => void;
  isEditMode?: boolean;
}

export const McpServerForm: React.FC<McpServerFormProps> = ({
  serverName,
  onServerNameChange,
  protocol,
  onProtocolChange,
  commandConfig,
  onCommandConfigChange,
  httpConfig,
  onHttpConfigChange,
  isEditMode = false,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-1">Server Name</div>
        <Input
          aria-label="Server name"
          value={serverName}
          onChange={(e) => onServerNameChange(e.target.value)}
          placeholder="e.g., fetch, deepwiki"
          disabled={isEditMode} // Disable name editing in edit mode if it's used as a key
        />
      </div>

      <Tabs
        value={protocol}
        onValueChange={(value) => onProtocolChange(value as 'stdio' | 'http' | 'sse')}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stdio">Stdio</TabsTrigger>
          <TabsTrigger value="http">HTTP</TabsTrigger>
          <TabsTrigger value="sse">SSE</TabsTrigger>
        </TabsList>

        <TabsContent value="stdio" className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Command</div>
            <Input
              aria-label="Command"
              value={commandConfig.command}
              onChange={(e) => onCommandConfigChange({ ...commandConfig, command: e.target.value })}
              placeholder="e.g., uvx, npx"
            />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Arguments</div>
            <Input
              aria-label="Arguments"
              value={commandConfig.args}
              onChange={(e) => onCommandConfigChange({ ...commandConfig, args: e.target.value })}
              placeholder="e.g., -y mcp-server-fetch"
            />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Environment Variables (JSON, optional)</div>
            <Textarea
              aria-label="Environment variables (JSON)"
              value={commandConfig.env}
              onChange={(e) => onCommandConfigChange({ ...commandConfig, env: e.target.value })}
              placeholder='{"API_KEY": "value"} - Leave empty if not needed'
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="http" className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">URL</div>
            <Input
              aria-label="Server URL"
              value={httpConfig.url}
              onChange={(e) => onHttpConfigChange({ ...httpConfig, url: e.target.value })}
              placeholder="https://mcp.deepwiki.com/mcp"
            />
          </div>
        </TabsContent>
        <TabsContent value="sse" className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">URL</div>
            <Input
              aria-label="Server URL"
              value={httpConfig.url}
              onChange={(e) => onHttpConfigChange({ ...httpConfig, url: e.target.value })}
              placeholder="https://mcp.deepwiki.com/sse"
            />
          </div>
        </TabsContent>
      </Tabs>
      {protocol !== 'stdio' && httpConfig.headers !== undefined && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Authentication headers
          </summary>
          <Textarea
            aria-label="Authentication headers (JSON)"
            value={httpConfig.headers ?? ''}
            onChange={(event) => onHttpConfigChange({ ...httpConfig, headers: event.target.value })}
            placeholder='{"Authorization": "Bearer token"}'
            className="mt-2 font-mono text-xs"
            rows={3}
          />
        </details>
      )}
    </div>
  );
};
