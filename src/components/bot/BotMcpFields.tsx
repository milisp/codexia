import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConnectorIcon } from '@/features/mcp/ConnectorIcon';
import { useKekeMcpAuth } from '@/features/mcp/useKekeMcpAuth';
import {
  type KekeMcpServer,
  kekeMcpSelection,
  readKekeMcpServers,
} from '@/services/apiAdapt/kekeMcp';

interface BotMcpFieldsProps {
  mcpServers: string[];
  onMcpServersChange: (names: string[]) => void;
  onManageTools: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function BotMcpFields({
  mcpServers,
  onMcpServersChange,
  onManageTools,
  disabled,
  compact = false,
}: BotMcpFieldsProps) {
  const auth = useKekeMcpAuth(!compact);
  const [configured, setConfigured] = useState<Record<string, KekeMcpServer> | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The refresh counter intentionally reloads definitions on request.
  useEffect(() => {
    let cancelled = false;
    readKekeMcpServers()
      .then((servers) => {
        if (!cancelled) {
          setConfigured(servers);
          setError('');
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setConfigured(null);
          setError(String(failure));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const toggle = (selection: string, checked: boolean) =>
    onMcpServersChange(
      checked
        ? [...new Set([...mcpServers, selection])]
        : mcpServers.filter((value) => value !== selection)
    );
  const names = [
    ...new Set([
      ...Object.keys(configured ?? {}),
      ...mcpServers.filter((name) => name.startsWith('keke:')).map((name) => name.slice(5)),
    ]),
  ].sort();
  const legacy = mcpServers.filter((name) => !name.startsWith('keke:'));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{compact ? 'Tools' : 'Apps and tools'}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Refresh tools"
            title="Refresh tools"
            onClick={() => {
              setRefreshKey((key) => key + 1);
              auth.refresh();
            }}
          >
            <RefreshCw />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onManageTools}
          >
            {compact ? 'Manage' : 'Save & manage tools'}
          </Button>
        </div>
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">Choose which tools this bot can use.</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          Could not load tools: {error}
        </p>
      )}
      {!configured && !error && <p className="text-xs text-muted-foreground">Loading tools…</p>}
      {configured && names.length === 0 && (
        <p className="text-xs text-muted-foreground">No tools added yet.</p>
      )}
      <div className="flex flex-col gap-2">
        {names.map((name) => {
          const selection = kekeMcpSelection(name);
          const config = configured?.[name];
          const selected = mcpServers.includes(selection);
          return (
            <Label
              key={name}
              className={
                compact
                  ? 'flex items-center justify-between gap-3 py-1 font-normal'
                  : 'flex items-center justify-between gap-3 rounded-md border p-3 font-normal'
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                {!compact && (
                  <Checkbox
                    checked={selected}
                    disabled={disabled || ((!config || config.disabled === true) && !selected)}
                    onCheckedChange={(checked) => toggle(selection, checked === true)}
                  />
                )}
                <ConnectorIcon name={name} />
                <span className="break-all">{name}</span>
              </span>
              {compact ? (
                <Switch
                  aria-label={name}
                  checked={selected}
                  disabled={disabled || ((!config || config.disabled === true) && !selected)}
                  title={!config ? 'Unavailable' : config.disabled ? 'Disabled' : undefined}
                  onCheckedChange={(checked) => toggle(selection, checked)}
                />
              ) : (
                <Badge variant="secondary">
                  {!config
                    ? 'Unavailable'
                    : config.disabled
                      ? 'Disabled'
                      : auth.statuses[name]?.signedIn
                        ? 'Authorized'
                        : 'Configured'}
                </Badge>
              )}
            </Label>
          );
        })}
        {legacy.map((selection) => (
          <Label
            key={selection}
            className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3 font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Checkbox
                checked
                disabled={disabled}
                onCheckedChange={() => toggle(selection, false)}
              />
              <span className="break-all">{selection}</span>
            </span>
            <Badge variant="secondary">Needs import</Badge>
          </Label>
        ))}
      </div>
    </div>
  );
}
