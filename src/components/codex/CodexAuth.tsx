import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { AccountLoginCompletedNotification, GetAccountResponse } from '@/bindings/v2';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isTauri } from '@/hooks/runtime';
import { getAccountWithParams, loginAccount } from '@/services';

const LOGIN_LABEL = 'Start ChatGPT login';

export function CodexAuth() {
  const isTauriRuntime = isTauri();
  const [account, setAccount] = useState<GetAccountResponse | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshAccount = useCallback(async (force: boolean) => {
    try {
      const response = await getAccountWithParams({
        refreshToken: force,
      });
      setAccount(response);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown');
      setLastError(message);
    }
  }, []);

  const startChatLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setLastStatus(LOGIN_LABEL);
    setLastError(null);
    try {
      const response = await loginAccount({
        type: 'chatgpt',
      });
      if (response.type === 'chatgpt') {
        await open(response.authUrl);
      }
      setLastStatus(`${LOGIN_LABEL} succeeded`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown');
      setLastStatus(`${LOGIN_LABEL} failed`);
      setLastError(message);
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

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

  const accountType = account?.account?.type ?? 'none';

  return (
    <Card className="border border-border/50">
      <CardHeader>
        <CardTitle>Codex auth</CardTitle>
        <CardDescription>.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>requires_openai_auth:</span>
          <Badge>{account?.requiresOpenaiAuth ? 'true' : 'false'}</Badge>
        </div>
        <div>
          <span className="font-semibold text-foreground">Account type:</span> {accountType}
        </div>
        {account?.account?.type === 'chatgpt' && (
          <div className="space-y-1">
            <p>Email: {account.account.email}</p>
            <p>Plan: {account.account.planType}</p>
          </div>
        )}
        {lastStatus && (
          <p className={`text-xs ${lastError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {lastStatus}
          </p>
        )}
        {lastError && <p className="text-xs text-destructive">Error: {lastError}</p>}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button onClick={startChatLogin} disabled={isLoggingIn}>
          {isLoggingIn ? `${LOGIN_LABEL}…` : LOGIN_LABEL}
        </Button>
      </CardFooter>
    </Card>
  );
}
