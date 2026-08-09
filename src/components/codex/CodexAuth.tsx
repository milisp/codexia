import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type {
  AccountLoginCompletedNotification,
  GetAccountResponse,
  LoginAccountParams,
} from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { isTauri } from '@/hooks/runtime';
import { getAccountWithParams, loginAccount } from '@/services';

export function CodexAuth() {
  const isTauriRuntime = isTauri();
  const [accountResponse, setAccountResponse] = useState<GetAccountResponse | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const refreshAccount = useCallback(async (force: boolean) => {
    try {
      const response = await getAccountWithParams({
        refreshToken: force,
      });
      setAccountResponse(response);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown');
      setLastError(message);
    }
  }, []);

  const handleLogin = useCallback(
    async (params: LoginAccountParams) => {
      setIsLoggingIn(true);
      setLastStatus(`Starting ${params.type === 'chatgpt' ? 'ChatGPT' : 'API Key'} login...`);
      setLastError(null);
      try {
        const response = await loginAccount(params);

        if (response.type === 'chatgpt') {
          await open(response.authUrl);
          setLastStatus('ChatGPT login started - please complete in browser');
        } else if (response.type === 'apiKey') {
          setLastStatus('Login successful');
          setApiKey('');
          void refreshAccount(true);
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error ?? 'Unknown');
        setLastStatus(null);
        setLastError(message);
      } finally {
        setIsLoggingIn(false);
      }
    },
    [refreshAccount]
  );

  const startChatGptLogin = useCallback(() => {
    handleLogin({ type: 'chatgpt' });
  }, [handleLogin]);

  const startApiKeyLogin = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!apiKey.trim()) {
        setLastError('Please enter an API key');
        return;
      }
      handleLogin({ type: 'apiKey', apiKey: apiKey.trim() });
    },
    [handleLogin, apiKey]
  );

  useEffect(() => {
    void refreshAccount(false);
  }, [refreshAccount]);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    const unlistenPromise = listen<ServerNotification>('codex:notification', (event) => {
      const { method, params } = event.payload;
      if (method === 'account/updated') {
        void refreshAccount(true);
        return;
      }
      if (method === 'account/login/completed') {
        const payload = params as AccountLoginCompletedNotification;
        if (payload.success) {
          void refreshAccount(true);
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [isTauriRuntime, refreshAccount]);

  return (
    <Card className="w-full max-w-md mx-auto border border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-center">Codex Authentication</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {accountResponse?.account?.type === 'chatgpt' && (
          <div className="space-y-1">
            <p>Email: {accountResponse.account.email}</p>
          </div>
        )}
        <div className="space-y-4">
          <Button onClick={startChatGptLogin} disabled={isLoggingIn} className="w-full" size="lg">
            {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoggingIn ? 'Starting ChatGPT login…' : 'Start ChatGPT Login'}
          </Button>

          <div className="relative my-2 text-center text-xs uppercase text-muted-foreground">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <span className="relative bg-background px-2">Or use API Key</span>
          </div>

          <form onSubmit={startApiKeyLogin} className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="apiKey">OpenAI API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                disabled={isLoggingIn}
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={isLoggingIn || !apiKey.trim()} className="w-full">
              {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoggingIn ? 'Verifying…' : 'Verify API Key'}
            </Button>
          </form>
        </div>

        {lastStatus && !lastError && (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{lastStatus}</span>
          </p>
        )}

        {lastError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{lastError}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
