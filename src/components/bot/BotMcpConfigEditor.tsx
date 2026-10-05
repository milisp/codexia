import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BotMcpConfigEditorProps {
  busy: boolean;
  onAdd: (name: string, config: Record<string, unknown>) => Promise<boolean>;
}

export function BotMcpConfigEditor({ busy, onAdd }: BotMcpConfigEditorProps) {
  const id = useId();
  const [name, setName] = useState('');
  const [json, setJson] = useState('{\n  "command": "",\n  "args": [],\n  "env": {}\n}');
  const [error, setError] = useState('');

  const add = async () => {
    setError('');
    try {
      const config: unknown = JSON.parse(json);
      if (!name.trim()) throw new Error('Enter a server name.');
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Enter one server configuration object, not the entire MCP file.');
      }
      if (await onAdd(name.trim(), config as Record<string, unknown>)) setName('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Custom server / JSON configuration
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Add a compatible MCP server to keke. Local commands run on this computer; only add trusted
          servers. Existing names are never replaced. To change a definition, remove it first.
        </p>
        <Label htmlFor={`${id}-name`}>Server name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          placeholder="my-server"
        />
        <Label htmlFor={`${id}-json`}>Server configuration (JSON)</Label>
        <Textarea
          id={`${id}-json`}
          value={json}
          disabled={busy}
          onChange={(event) => setJson(event.target.value)}
          rows={7}
          className="font-mono text-xs"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          For computer use, paste a compatible MCP server configuration here. This does not import a
          desktop integration, install software, or grant screen/accessibility permissions.
        </p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="button" size="sm" disabled={busy} onClick={add}>
          Add to keke
        </Button>
      </div>
    </details>
  );
}
