import { ChevronDown, ChevronRight, CircleGauge } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { RateLimitWindow } from '@/bindings/v2';
import type { GetAccountRateLimitsResponse } from '@/bindings/v2/GetAccountRateLimitsResponse';
import { getAccountRateLimits } from '@/services';

function formatTimestamp(timestamp: number | null | undefined, locale: string = 'en'): string {
  if (!timestamp) return '0';
  const ms = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  const options: Intl.DateTimeFormatOptions = {
    month: locale.startsWith('zh') ? 'long' : 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString(locale, options);
}

function getRemainingPercent(window: RateLimitWindow | null) {
  const usedPercent = window ? Number(window.usedPercent ?? 0) : 0;
  return Math.max(0, 100 - usedPercent);
}

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

/** Trigger row — must be used inside a DropdownMenuItem */
export function RateLimitTrigger({ isOpen }: { isOpen: boolean }) {
  return (
    <span className="flex w-full items-center justify-between">
      <span className="flex items-center gap-2">
        <CircleGauge className="w-4 h-4" />
        <span>Usage remaining</span>
      </span>
      {isOpen ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

/** Content row — accepts primaryWindow passed from parent */
export function RateLimitContent({ primaryWindow }: { primaryWindow: RateLimitWindow | null }) {
  return (
    <div className="flex justify-between px-2 py-1 text-xs text-muted-foreground">
      <span>Monthly</span>
      <span className="flex gap-2">
        <span>{getRemainingPercent(primaryWindow)}%</span>
        <span>{formatTimestamp(primaryWindow?.resetsAt)}</span>
      </span>
    </div>
  );
}

/** Standalone widget (used outside DropdownMenu) */
export function RateLimitWidget() {
  const rateLimits = useRateLimits();
  const primaryWindow = rateLimits?.rateLimits.primary ?? null;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full px-2 py-1.5">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center justify-between font-medium text-foreground hover:opacity-80 transition-opacity cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((o) => !o);
          }
        }}
      >
        <RateLimitTrigger isOpen={isOpen} />
      </div>
      {isOpen && (
        <div className="flex justify-between pt-2 text-sm">
          <span>Monthly</span>
          <span className="flex gap-2 text-muted-foreground">
            <span>{getRemainingPercent(primaryWindow)}%</span>
            <span>{formatTimestamp(primaryWindow?.resetsAt)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
