import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_PORT } from '@/hooks/runtime';
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

/** Confirms the host and token before storing them, so a typo fails here. */
async function verify(desktop: PairedDesktop): Promise<string | null> {
  try {
    const response = await fetch(`${desktopBaseUrl(desktop)}/api/pairing`, {
      headers: { Authorization: `Bearer ${desktop.token}` },
    });
    if (response.status === 401) return 'The desktop rejected this token.';
    if (!response.ok) return `The desktop answered with ${response.status}.`;
    return null;
  } catch {
    return 'Could not reach that desktop. Check that it is awake and on the same tailnet.';
  }
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

  const save = async () => {
    setError(null);

    if (isTailnetIP(trimmedHost)) {
      setError(
        'Use the Tailscale hostname ending in .ts.net instead of the tailnet IP; iOS blocks plain HTTP to raw addresses.'
      );
      return;
    }

    const desktop: PairedDesktop = {
      name: name.trim() || trimmedHost,
      host: trimmedHost,
      port: Number(port) || DEFAULT_PORT,
      token: trimmedToken,
    };

    setVerifying(true);
    const failure = await verify(desktop);
    setVerifying(false);

    if (failure) {
      setError(failure);
      return;
    }
    addDesktop(desktop);
    onPaired?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Pair desktop</CardTitle>
          <CardDescription>
            Open Settings → Remote access on the desktop to find its hostname and device token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pairing-name">Name</Label>
            <Input
              id="pairing-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Mac"
            />
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
