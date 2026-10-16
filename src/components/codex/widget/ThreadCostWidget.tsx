import { useCodexStore } from '@/components/codex/stores/useCodexStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  formatCreditsMicros,
  formatThreadCost,
  formatUsdMicros,
  groupLabel,
} from './threadUsageFormat';
import { useThreadUsage } from './useThreadUsage';

/** Compact estimated cost of the current thread; details live in the popover. */
export function ThreadCostWidget() {
  const currentThreadId = useCodexStore((state) => state.currentThreadId);
  const totalTokens = useCodexStore((state) =>
    state.currentThreadId ? (state.tokenUsageMap[state.currentThreadId]?.total.totalTokens ?? 0) : 0
  );
  const usage = useThreadUsage(currentThreadId, totalTokens);
  const cost = formatThreadCost(usage);

  if (!usage || !cost) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center h-6 px-1.5 rounded-md text-xs font-mono tabular-nums text-muted-foreground hover:bg-accent transition-colors"
          aria-label={`Estimated thread cost ${cost}`}
        >
          ~{cost}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 p-3 text-xs space-y-1.5">
        <p className="font-medium text-sm">Estimated cost</p>
        <p className="text-muted-foreground">
          Estimate for this thread only. Actual billing may differ.
        </p>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Credits</span>
          <span className="font-mono tabular-nums">
            {formatCreditsMicros(usage.estimatedUsageCreditsMicros)}
          </span>
        </div>
        {usage.estimatedUsageUsdMicros !== null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">USD</span>
            <span className="font-mono tabular-nums">
              {formatUsdMicros(usage.estimatedUsageUsdMicros)}
            </span>
          </div>
        )}
        {usage.groups.length > 0 && (
          <ul className="border-t pt-1.5 space-y-1" aria-label="Cost by model">
            {usage.groups.map((group) => (
              <li
                key={`${group.model}-${group.reasoningEffort}-${group.speed}`}
                className="flex justify-between gap-2"
              >
                <span className="truncate text-muted-foreground">{groupLabel(group)}</span>
                <span className="font-mono tabular-nums shrink-0">
                  {formatCreditsMicros(group.estimatedUsageCreditsMicros)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
