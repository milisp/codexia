import { AlertTriangle, QrCode } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_PORT, isPhone } from '@/hooks/runtime';
import { parsePairingUri } from '@/lib/pairing';
import { desktopBaseUrl, type PairedDesktop, usePairingStore } from '@/stores/usePairingStore';

/**
 * Rejects a raw tailnet address (100.64.0.0/10).
 *
 * iOS App Transport Security blocks plain HTTP to a bare IP, but allows it to
 * the `.ts.net` hostname once the Info.plist exception is in place, so the
 * hostname is the only form that actually connects.
 */
function isTailnetIP(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const [first, second] = [Number(parts[0]), Number(parts[1])];
  return first === 100 && second >= 64 && second <= 127;
}

/** What `/api/pairing` reports back once the token is accepted. */
type PairingInfo = { tailscale?: { dns_name?: string } | null };

/**
 * Confirms the host and token before storing them, so a typo fails here.
 *
 * Returns the desktop's own description of itself on success, which is where
 * the auto-filled name comes from.
 */
async function verify(desktop: PairedDesktop): Promise<{ error: string } | { info: PairingInfo }> {
  try {
    const response = await fetch(`${desktopBaseUrl(desktop)}/api/pairing`, {
      headers: { Authorization: `Bearer ${desktop.token}` },
    });
    if (response.status === 401) return { error: 'The desktop rejected this token.' };
    if (!response.ok) return { error: `The desktop answered with ${response.status}.` };
    return { info: (await response.json()) as PairingInfo };
  } catch {
    return {
      error: 'Could not reach that desktop. Check that it is awake and on the same tailnet.',
    };
  }
}

/**
 * The machine's own name, taken from the first label of its MagicDNS name
 * (`codexia-mac.tail1234.ts.net` → `codexia-mac`).
 */
function autoName(info: PairingInfo, host: string): string {
  const dnsName = info.tailscale?.dns_name?.replace(/\.$/, '');
  return dnsName?.split('.')[0] || host.split('.')[0] || host;
}

/**
 * Point this device at a desktop and authenticate.
 *
 * Serves both entry points: the first-run screen, where there is nothing to go
 * back to, and "Pair a desktop" from the drawer, which passes `onCancel`.
 */
export function PairingView({
  onPaired,
  onCancel,
}: {
  onPaired?: () => void;
  onCancel?: () => void;
} = {}) {
  const addDesktop = usePairingStore((s) => s.addDesktop);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(String(DEFAULT_PORT));
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedHost = host.trim();
  const trimmedToken = token.trim();
  const canSave = trimmedHost.length > 0 && trimmedToken.length > 0 && !verifying;

  /** Shared tail of both entry points: check the desktop answers, then store it. */
  const pair = async (desktop: PairedDesktop) => {
    setError(null);

    if (isTailnetIP(desktop.host)) {
      setError(
        'Use the Tailscale hostname ending in .ts.net instead of the tailnet IP; iOS blocks plain HTTP to raw addresses.'
      );
      return;
    }

    setVerifying(true);
    const result = await verify(desktop);
    setVerifying(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }
    // Left blank: adopt the name the desktop reports for itself. Still editable
    // afterwards from the Desktops drawer.
    addDesktop({ ...desktop, name: desktop.name || autoName(result.info, desktop.host) });
    onPaired?.();
  };

  const save = () =>
    pair({
      name: name.trim(),
      host: trimmedHost,
      port: Number(port) || DEFAULT_PORT,
      token: trimmedToken,
    });

  /**
   * Reads the desktop's pairing code with the camera.
   *
   * The scanned values also land in the form, so a code that fails to verify
   * leaves something the user can inspect and correct by hand.
   */
  const scanCode = async () => {
    setError(null);
    try {
      const { Format, cancel, checkPermissions, requestPermissions, scan } = await import(
        '@tauri-apps/plugin-barcode-scanner'
      );

      const current = await checkPermissions();
      const permission = current === 'granted' ? current : await requestPermissions();
      if (permission !== 'granted') {
        setError('Camera access is off for Codexia. Enable it in iOS Settings and try again.');
        return;
      }

      const result = await scan({ windowed: false, formats: [Format.QRCode] });
      await cancel();

      const desktop = parsePairingUri(result.content);
      if (!desktop) {
        setError(
          'That is not a Codexia pairing code. Open Settings → Remote access on the desktop.'
        );
        return;
      }

      setName(desktop.name);
      setHost(desktop.host);
      setPort(String(desktop.port));
      setToken(desktop.token);
      await pair(desktop);
    } catch (err) {
      setError(`Could not scan: ${err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Pair desktop</CardTitle>
          <CardDescription>
            Open Settings → Remote access on the desktop, then scan its QR code — or type the
            hostname and token shown there.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPhone() && (
            <Button variant="secondary" className="w-full" disabled={verifying} onClick={scanCode}>
              <QrCode className="size-4" />
              Scan QR code
            </Button>
          )}

          <div className="space-y-2">
            <Label htmlFor="pairing-name">Name</Label>
            <Input
              id="pairing-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Mac"
            />
            <p className="text-muted-foreground text-xs">
              Leave blank to use the name the desktop reports.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pairing-host">Hostname</Label>
            <Input
              id="pairing-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              placeholder="codexia-mac.tail1234.ts.net"
            />
            <p className="text-muted-foreground text-xs">
              Use the Tailscale name shown on the desktop.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pairing-port">Port</Label>
            <Input
              id="pairing-port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pairing-token">Device token</Label>
            <Input
              id="pairing-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-muted-foreground text-xs">
              The token grants full access to that machine. Treat it like an SSH key.
            </p>
          </div>

          {error && (
            <p className="flex items-start gap-2 text-destructive text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" className="flex-1" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button className="flex-1" disabled={!canSave} onClick={save}>
              {verifying ? 'Checking…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
