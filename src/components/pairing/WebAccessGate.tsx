import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authHeaders, buildUrl } from '@/hooks/runtime';
import { useWebAccessStore } from '@/stores/useWebAccessStore';

type Access = 'checking' | 'open' | 'locked' | 'unreachable';

/** Asks the server whether this browser may use the API. */
async function probe(): Promise<Access> {
  try {
    const response = await fetch(buildUrl('/api/pairing'), { headers: authHeaders() });
    if (response.status === 401) return 'locked';
    return response.ok ? 'open' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

/**
 * Holds the browser build until it can reach its server.
 *
 * A browser on the server itself is let through without a token; any other
 * browser signs in with the device token, normally by opening the link that
 * `codexia-web pair` prints.
 */
export function WebAccessGate({ children }: { children: ReactNode }) {
  const token = useWebAccessStore((s) => s.token);
  const setToken = useWebAccessStore((s) => s.setToken);
  const [access, setAccess] = useState<Access>('checking');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    const result = await probe();
    setAccess(result);
    return result;
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const connect = async () => {
    setError(null);
    const previous = token;
    setToken(draft.trim());
    const result = await check();
    if (result === 'locked') {
      setToken(previous);
      setAccess('locked');
      setError('The server rejected this token.');
    }
  };

  if (access === 'open') return <>{children}</>;
  if (access === 'checking') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{access === 'locked' ? 'Connect to server' : 'Server unreachable'}</CardTitle>
          <CardDescription>
            {access === 'locked' ? (
              <>
                On the server, run <code>codexia-web pair</code> and open the browser link, or paste
                the token here.
              </>
            ) : (
              'Check that codexia-web is running and reachable from this device.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {access === 'locked' ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                connect();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="web-access-token">Token</Label>
                <Input
                  id="web-access-token"
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                />
                {error && <p className="text-destructive text-sm">{error}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={!draft.trim()}>
                Connect
              </Button>
            </form>
          ) : (
            <Button className="w-full" onClick={() => check()}>
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
