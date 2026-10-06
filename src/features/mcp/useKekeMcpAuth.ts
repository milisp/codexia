import { useCallback, useEffect, useRef, useState } from 'react';
import {
  authorizeGitHubMcp,
  type KekeMcpAuthStatus,
  type KekeMcpServer,
  loginKekeMcpServer,
  readKekeMcpAuthStatuses,
  readKekeMcpServers,
} from '@/services/apiAdapt/kekeMcp';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { isGitHubMcpServer, mcpAuthError } from './mcpAuthentication';

export function useKekeMcpAuth(enabled = true) {
  const [statuses, setStatuses] = useState<Record<string, KekeMcpAuthStatus>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [githubName, setGitHubName] = useState<string | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const request = ++requestId.current;
    try {
      const result = await readKekeMcpAuthStatuses();
      if (mounted.current && request === requestId.current) {
        setStatuses(result);
        setError('');
      }
    } catch (failure) {
      if (mounted.current && request === requestId.current) setError(String(failure));
    }
  }, [enabled]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [refresh]);

  const authorize = async (name: string, config?: KekeMcpServer) => {
    if (busy.current) return false;
    busy.current = true;
    setPending(name);
    setErrors((previous) => ({ ...previous, [name]: '' }));
    try {
      if (isGitHubMcpServer(config)) {
        const current = (await readKekeMcpServers())[name];
        const metadata = current?._meta as Record<string, unknown> | undefined;
        if (!current?.oauth && !metadata?.['keke.dev/oauth']) {
          if (mounted.current) setGitHubName(name);
          return false;
        }
      }
      await loginKekeMcpServer(name);
      useBotUiStore.getState().markMcpChanged(name);
      if (mounted.current)
        setStatuses((previous) => ({ ...previous, [name]: { signedIn: true, error: null } }));
      await refresh();
      return true;
    } catch (failure) {
      if (mounted.current)
        setErrors((previous) => ({ ...previous, [name]: mcpAuthError(failure) }));
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  };
  const authorizeGitHub = async (token: string) => {
    const name = githubName;
    if (!name || busy.current) return false;
    busy.current = true;
    setPending(name);
    setErrors((previous) => ({ ...previous, [name]: '' }));
    try {
      await authorizeGitHubMcp(name, token.trim());
      useBotUiStore.getState().markMcpChanged(name);
      if (mounted.current) {
        setStatuses((previous) => ({ ...previous, [name]: { signedIn: true, error: null } }));
        setGitHubName(null);
      }
      await refresh();
      return true;
    } catch (failure) {
      if (mounted.current)
        setErrors((previous) => ({ ...previous, [name]: mcpAuthError(failure) }));
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  };
  return {
    statuses,
    pending,
    errors,
    error,
    refresh,
    authorize,
    githubName,
    authorizeGitHub,
    dismissGitHub: () => {
      if (!busy.current) setGitHubName(null);
    },
  };
}
