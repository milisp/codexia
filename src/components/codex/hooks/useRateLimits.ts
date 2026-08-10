import { useCallback, useEffect, useState } from 'react';
import type { GetAccountRateLimitsResponse } from '@/bindings/v2/GetAccountRateLimitsResponse';
import { getAccountRateLimits } from '@/services';

export function useRateLimits() {
  const [rateLimits, setRateLimits] = useState<GetAccountRateLimitsResponse | null>(null);

  const fetchRateLimits = useCallback(async () => {
    try {
      const response = await getAccountRateLimits();
      setRateLimits(response);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRateLimits();
  }, [fetchRateLimits]);

  return rateLimits;
}
