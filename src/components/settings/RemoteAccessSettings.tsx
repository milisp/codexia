import { Check, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { isDesktopTauri } from '@/hooks/runtime';
import { buildPairingUri } from '@/lib/pairing';
import {
  type RemoteStatus,
  remoteGetStatus,
  remoteRotateToken,
  remoteStart,
  remoteStop,
} from '@/services/apiAdapt/remote';
import { usePairingStore } from '@/stores/usePairingStore';

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

/**
 * The QR code a phone scans to pair.
 *
 * Hidden until asked: the code carries the device token in the clear, and this
 * screen is the one people share on a call or in a screenshot.
 */
function PairingCode({ uri }: { uri: string }) {
  const [shown, setShown] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">Pairing QR code</div>
        <Button variant="ghost" size="sm" onClick={() => setShown((v) => !v)}>
          {shown ? 'Hide' : 'Show'}
        </Button>
      </div>
      {shown ? (
        <div className="flex flex-col items-center gap-2 rounded border p-4">
          {/* Fixed white background: a QR code has to stay light-on-dark-free to scan. */}
          <QRCodeSVG value={uri} size={192} bgColor="#ffffff" fgColor="#000000" marginSize={2} />
          <p className="text-center text-xs text-muted-foreground">
            In the Codexia mobile app, tap “Scan QR code”.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Contains the token. Only show it to a camera you trust.
        </p>
      )}
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

  async function rotate() {
    if (
      !window.confirm(
        'Issue a new device token? Every paired device stops working until it pairs again.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await remoteRotateToken());
    } catch (err) {
      setError(String(err));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const tailscale = status?.tailscale;
  const canToggle = isDesktopTauri();
  const desktops = usePairingStore((s) => s.desktops);
  const removeDesktop = usePairingStore((s) => s.removeDesktop);

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

          {status?.token && tailscale && (
            <PairingCode
              uri={buildPairingUri({
                name: tailscale.dns_name.split('.')[0],
                host: tailscale.dns_name,
                port: status.port,
                token: status.token,
              })}
            />
          )}

          {canToggle && status?.token && (
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Rotating the token revokes it everywhere. Every phone paired with this machine has
                to scan the new code.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={busy}
                onClick={rotate}
              >
                Rotate token
              </Button>
            </div>
          )}

          {desktops.length > 0 ? (
            <div className="space-y-3 border-t pt-4">
              {desktops.map((desktop) => (
                <div key={desktop.host} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="truncate text-sm font-medium">Paired with {desktop.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {desktop.host}:{desktop.port}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => removeDesktop(desktop.host)}
                  >
                    Unpair
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enter the hostname, port and token in the Codexia mobile app to pair this machine. The
              token grants full access to this computer — treat it like an SSH key. Requests from
              this machine itself never need it.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
