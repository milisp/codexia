import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { isDesktopTauri } from '@/hooks/runtime';
import {
  remoteGetStatus,
  remoteStart,
  remoteStop,
  type RemoteStatus,
} from '@/services/apiAdapt/remote';

function CopyField({ label, value, mask }: { label: string; value: string; mask?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shown = mask && !revealed ? '•'.repeat(Math.min(value.length, 32)) : value;

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{shown}</code>
        {mask && (
          <Button variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)}>
            {revealed ? 'Hide' : 'Show'}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function RemoteAccessSettings() {
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await remoteGetStatus());
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      setStatus(next ? await remoteStart() : await remoteStop());
    } catch (err) {
      setError(String(err));
      // Re-read rather than trust the optimistic value: a failed start leaves
      // the server stopped, and the switch must reflect that.
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const tailscale = status?.tailscale;
  const canToggle = isDesktopTauri();

  return (
    <section className="space-y-3">
      <h3 className="px-1 text-sm font-medium">Remote Access</h3>

      <Card>
        <CardContent className="space-y-4 px-4 py-4">
          {canToggle && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Accept connections from my devices</div>
                <div className="text-xs text-muted-foreground">
                  {status?.running
                    ? `Listening on ${status.host}:${status.port}`
                    : 'Serves this desktop’s sessions to the Codexia iOS app over Tailscale.'}
                </div>
              </div>
              <Switch
                checked={status?.running ?? false}
                disabled={busy || !tailscale}
                onCheckedChange={toggle}
              />
            </div>
          )}

          {error && <div className="text-xs text-destructive">{error}</div>}

          {!tailscale && (
            <div className="text-xs text-muted-foreground">
              Tailscale was not detected. Install it and sign in on both this machine and your
              phone, then reopen this screen.
            </div>
          )}

          {tailscale && (
            <>
              <CopyField label="Tailscale hostname" value={tailscale.dns_name} />
              <CopyField label="Tailnet IP" value={tailscale.ipv4} />
            </>
          )}

          {status && <CopyField label="Port" value={String(status.port)} />}
          {status?.token && <CopyField label="Device token" value={status.token} mask />}

          <p className="text-xs text-muted-foreground">
            Enter the hostname, port and token in the Codexia iOS app to pair this machine. The
            token grants full access to this computer — treat it like an SSH key. Requests from this
            machine itself never need it.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
