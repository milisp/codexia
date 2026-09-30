import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { unifiedReadMcpConfig } from '@/services';

interface BotMcpFieldsProps {
  mcpServers: string[];
  onMcpServersChange: (names: string[]) => void;
}

/** The Codex-configured MCP servers this bot may use, by name. */
export function BotMcpFields({ mcpServers, onMcpServersChange }: BotMcpFieldsProps) {
  const [configured, setConfigured] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    unifiedReadMcpConfig('codex')
      .then((config) => {
        if (!cancelled) setConfigured(Object.keys(config.mcpServers ?? {}));
      })
      .catch(() => {
        if (!cancelled) setConfigured([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A server the bot has selected but that is no longer configured stays listed,
  // so saving does not silently drop it.
  const names = [...new Set([...(configured ?? []), ...mcpServers])].sort();

  const toggle = (name: string, checked: boolean) => {
    onMcpServersChange(
      checked ? [...new Set([...mcpServers, name])] : mcpServers.filter((n) => n !== name)
    );
  };

  return (
    <div className="space-y-1">
      <Label>MCP servers</Label>
      {configured === null ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : names.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          No MCP servers configured yet.
        </p>
      ) : (
        <div className="space-y-1">
          {names.map((name) => (
            <Label
              key={name}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal"
            >
              <Checkbox
                checked={mcpServers.includes(name)}
                onCheckedChange={(checked) => toggle(name, checked === true)}
              />
              <span className="truncate">{name}</span>
              {!configured.includes(name) && (
                <span className="text-xs text-muted-foreground">(not configured)</span>
              )}
            </Label>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        The bot can always reach the other bots through the built-in codexia-bots server. Set up
        servers on the MCP page.
      </p>
    </div>
  );
}
