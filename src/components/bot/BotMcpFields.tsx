import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { appPresets } from '@/features/mcp/appPresets';
import {
  addKekeMcpServer,
  type KekeMcpServer,
  kekeMcpSelection,
  readKekeMcpServers,
  removeKekeMcpServer,
} from '@/services/apiAdapt/kekeMcp';
import { unifiedReadMcpConfig } from '@/services/apiAdapt/mcp';
import { BotMcpConfigEditor } from './BotMcpConfigEditor';

interface BotMcpFieldsProps {
  mcpServers: string[];
  onMcpServersChange: (names: string[]) => void;
}

export function BotMcpFields({ mcpServers, onMcpServersChange }: BotMcpFieldsProps) {
  const [configured, setConfigured] = useState<Record<string, KekeMcpServer> | null>(null);
  const [imports, setImports] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [removeName, setRemoveName] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey explicitly reloads the on-disk configuration.
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

  const add = async (name: string, config: Record<string, unknown>) => {
    setBusy(true);
    try {
      await addKekeMcpServer(name, config);
      setRefreshKey((key) => key + 1);
      toast.success(
        'Added to keke. Select it below to include it in this bot’s session configuration.'
      );
      return true;
    } catch (failure) {
      toast.error(`Could not add server; existing definitions are preserved: ${failure}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string) => {
    setBusy(true);
    try {
      await removeKekeMcpServer(name);
      setRemoveName(null);
      setRefreshKey((key) => key + 1);
      toast.success('Definition removed. Saved bot selections are preserved.');
    } catch (failure) {
      toast.error(`Could not remove server: ${failure}`);
    } finally {
      setBusy(false);
    }
  };

  const loadImports = async () => {
    setBusy(true);
    try {
      const config = await unifiedReadMcpConfig('codex');
      setImports(config.mcpServers ?? {});
    } catch (failure) {
      toast.error(`Could not read Codex definitions: ${failure}`);
    } finally {
      setBusy(false);
    }
  };

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
    <div className="space-y-3">
      <div>
        <Label>Apps and tools</Label>
        <p className="text-xs text-muted-foreground">
          Definitions live in <code>~/.keke/.mcp.json</code>, not Codex. Adding a definition and
          selecting it for this bot are separate steps.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {appPresets.map((preset) => (
          <Button
            key={preset.name}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !configured || preset.name in configured}
            onClick={() => add(preset.name, preset.config as Record<string, unknown>)}
          >
            {preset.name === 'github' ? 'GitHub' : 'Slack'}
            {configured && preset.name in configured ? ' configured' : ' — add definition'}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setRefreshKey((key) => key + 1)}
        >
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Presets require provider authorization. Codex OAuth credentials are not transferred. A
        definition is not a connection test or a permission grant.
      </p>
      <p className="text-xs text-muted-foreground">
        Bots require strict MCP isolation: only selected external servers are installed, plus
        separately authorized bot collaboration. Global, workspace and plugin MCP servers are
        excluded. An unsupported keke runtime cannot start the bot. Tool approvals and provider
        permissions still apply.
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          Could not load keke configuration: {error}. Saved selections are preserved; refresh to
          retry.
        </p>
      )}
      {!configured && !error && (
        <p className="text-xs text-muted-foreground">Loading keke configuration…</p>
      )}
      {configured && names.length === 0 && (
        <p className="text-xs text-muted-foreground">No keke servers configured yet.</p>
      )}
      <div className="space-y-2">
        {names.map((name) => {
          const selection = kekeMcpSelection(name);
          const config = configured?.[name];
          const selected = mcpServers.includes(selection);
          return (
            <div key={name} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex min-w-0 items-center gap-2 font-normal">
                  <Checkbox
                    checked={selected}
                    disabled={busy || ((!config || config.disabled === true) && !selected)}
                    onCheckedChange={(checked) => toggle(selection, checked === true)}
                  />
                  <span className="break-all">{name}</span>
                </Label>
                {config && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRemoveName(name)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {!config
                  ? 'Missing or unavailable; saved selection retained'
                  : config.disabled
                    ? 'Disabled in keke'
                    : 'Configured in keke · connection not verified'}
              </p>
              {config && (
                <details>
                  <summary className="cursor-pointer text-xs">
                    View configuration (may contain secrets)
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(config, null, 2)}
                  </pre>
                </details>
              )}
              {removeName === name && (
                <div className="space-y-2">
                  <p className="text-xs">
                    Remove this definition from keke for all bots? Saved selections will become
                    unavailable.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => remove(name)}
                  >
                    Confirm removal
                  </Button>{' '}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setRemoveName(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {legacy.map((selection) => (
          <div key={selection} className="rounded-md border border-dashed p-3 space-y-2">
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked onCheckedChange={() => toggle(selection, false)} disabled={busy} />
              <span className="break-all">{selection}</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Legacy selection — not used by keke. Preserved until you remove it. Import a
              definition if needed, then explicitly select the keke server above; matching names are
              not automatically trusted.
            </p>
          </div>
        ))}
      </div>
      <BotMcpConfigEditor busy={busy || !configured} onAdd={add} />
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">Explicit import from Codex</summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Read Codex definitions only when requested. Review each definition before copying it
            into keke. Existing names cannot be overwritten; unsupported configurations will be
            rejected. OAuth sessions and desktop computer-use integrations are not imported.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !configured}
            onClick={loadImports}
          >
            Read Codex definitions
          </Button>
          {imports && Object.keys(imports).length === 0 && (
            <p className="text-xs text-muted-foreground">No Codex definitions found.</p>
          )}
          {imports &&
            Object.entries(imports).map(([name, config]) => (
              <details key={name} className="rounded-md border p-2">
                <summary className="cursor-pointer text-sm">
                  {name} — review before import (may contain secrets)
                </summary>
                <pre className="my-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
                  {JSON.stringify(config, null, 2)}
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    busy ||
                    !configured ||
                    name in configured ||
                    !config ||
                    typeof config !== 'object' ||
                    Array.isArray(config)
                  }
                  onClick={() => add(name, config as Record<string, unknown>)}
                >
                  Copy definition to keke
                </Button>
              </details>
            ))}
        </div>
      </details>
      <p className="text-xs text-muted-foreground">
        Save the bot selection and start a new session to apply it. Removal affects all bots using
        this file.
      </p>
    </div>
  );
}
