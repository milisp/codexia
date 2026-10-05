import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type KekeMcpAuthStatus,
  loginKekeMcpServer,
  readKekeMcpAuthStatuses,
} from '@/services/apiAdapt/kekeMcp';

export function useKekeMcpAuth(enabled = true) {
  const [statuses, setStatuses] = useState<Record<string, KekeMcpAuthStatus>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
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

  const authorize = async (name: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(name);
    setErrors((previous) => ({ ...previous, [name]: '' }));
    try {
      await loginKekeMcpServer(name);
      if (mounted.current)
        setStatuses((previous) => ({ ...previous, [name]: { signedIn: true, error: null } }));
      await refresh();
    } catch (failure) {
      if (mounted.current) setErrors((previous) => ({ ...previous, [name]: String(failure) }));
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  };
  return { statuses, pending, errors, error, refresh, authorize };
}
