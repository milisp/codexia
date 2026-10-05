import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  addKekeMcpServer,
  type KekeMcpServer,
  readKekeMcpServers,
  removeKekeMcpServer,
} from '@/services/apiAdapt/kekeMcp';
import { unifiedReadMcpConfig } from '@/services/apiAdapt/mcp';
import { ConnectorIcon } from './ConnectorIcon';
import { KekeMcpAuthControl } from './KekeMcpAuthControl';
import { KekeMcpJsonEditor } from './KekeMcpJsonEditor';
import { useKekeMcpAuth } from './useKekeMcpAuth';

/** Manage shared Bot definitions here; access selection belongs to Bot settings. */
export function KekeMcpView({ refreshKey = 0 }: { refreshKey?: number }) {
  const auth = useKekeMcpAuth();
  const [servers, setServers] = useState<Record<string, KekeMcpServer>>({});
  const [imports, setImports] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeName, setRemoveName] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await readKekeMcpServers());
      setError('');
    } catch (failure) {
      setError(String(failure));
    } finally {
      setLoading(false);
    }
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: External connector changes intentionally reload definitions.
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const add = async (name: string, config: Record<string, unknown>) => {
    setBusy(true);
    try {
      await addKekeMcpServer(name, config);
      await load();
      toast.success(`${name} configured. Select it in your bot’s settings.`);
      return true;
    } catch (failure) {
      toast.error(`Could not add ${name}: ${failure}`);
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
      await load();
    } catch (failure) {
      toast.error(`Could not remove ${name}: ${failure}`);
    } finally {
      setBusy(false);
    }
  };
  const readImports = async () => {
    setBusy(true);
    try {
      setImports((await unifiedReadMcpConfig('codex')).mcpServers ?? {});
    } catch (failure) {
      toast.error(`Could not read Codex tools: ${failure}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Bot connectors</h3>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Refresh bot connectors"
          title="Refresh"
          onClick={() => {
            load();
            auth.refresh();
          }}
        >
          <RefreshCw />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Could not load connectors: {error}
        </p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {auth.error && (
        <p role="alert" className="text-sm text-destructive">
          Could not check authorization: {auth.error}
        </p>
      )}
      {!loading && !error && Object.keys(servers).length === 0 && (
        <p className="text-sm text-muted-foreground">No connectors added yet.</p>
      )}
      {Object.entries(servers).map(([name, config]) => (
        <div key={name} className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-3">
            <ConnectorIcon name={name} />
            <span className="min-w-0 flex-1 break-all text-sm font-medium">{name}</span>
            <Badge variant="secondary">
              {config.disabled
                ? 'Disabled'
                : auth.statuses[name]?.signedIn
                  ? 'Authorized'
                  : 'Configured'}
            </Badge>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoveName(name)}>
              Remove
            </Button>
          </div>
          {(config.type === 'http' || config.type === 'sse') && !config.disabled && (
            <KekeMcpAuthControl name={name} auth={auth} disabled={busy} />
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Configuration</summary>
            <p className="my-2 text-muted-foreground">Configuration may contain secrets.</p>
            {auth.statuses[name]?.error && (
              <p className="my-2 text-destructive">
                Authorization status unavailable: {auth.statuses[name].error}
              </p>
            )}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(config, null, 2)}
            </pre>
          </details>
          {removeName === name && (
            <div className="flex flex-col gap-2">
              <p className="text-xs">Remove {name} for all bots?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void remove(name)}
                >
                  Confirm removal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRemoveName(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Advanced</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Bot definitions are stored in <code>~/.keke/.mcp.json</code>. Only tools selected for a
            bot are loaded.
          </p>
          <KekeMcpJsonEditor busy={busy || loading || Boolean(error)} onAdd={add} />
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm">Import from Codex</summary>
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Review before copying. Existing names and OAuth sessions are not imported.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || loading || Boolean(error)}
                onClick={() => void readImports()}
              >
                Read Codex definitions
              </Button>
              {imports && Object.keys(imports).length === 0 && (
                <p className="text-xs text-muted-foreground">No definitions found.</p>
              )}
              {imports &&
                Object.entries(imports).map(([name, config]) => (
                  <details key={name}>
                    <summary className="cursor-pointer text-xs">
                      {name} · review configuration
                    </summary>
                    <pre className="my-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
                      {JSON.stringify(config, null, 2)}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy ||
                        name in servers ||
                        !config ||
                        typeof config !== 'object' ||
                        Array.isArray(config)
                      }
                      onClick={() => void add(name, config as Record<string, unknown>)}
                    >
                      Import {name}
                    </Button>
                  </details>
                ))}
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}
