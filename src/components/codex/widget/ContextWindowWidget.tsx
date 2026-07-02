import { useCodexStore } from '@/components/codex/stores/useCodexStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ContextWindowWidget() {
  const currentThreadId = useCodexStore((state) => state.currentThreadId);
  const tokenUsageMap = useCodexStore((state) => state.tokenUsageMap);
  const usage = currentThreadId ? tokenUsageMap[currentThreadId] : null;

  if (!usage) return null;

  const totalTokens = usage.total.totalTokens;
  const lastTokens = usage.last.totalTokens;
  const cachedTokens = usage.last.cachedInputTokens;
  const { modelContextWindow } = usage;

  const usagePercent =
    modelContextWindow && modelContextWindow > 0
      ? Math.min(100, Math.round((totalTokens / modelContextWindow) * 100))
      : null;

  const strokeColor =
    usagePercent === null
      ? 'stroke-muted-foreground'
      : usagePercent >= 80
        ? 'stroke-destructive'
        : usagePercent >= 50
          ? 'stroke-yellow-500'
          : 'stroke-green-500';

  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    usagePercent !== null ? circumference - (usagePercent / 100) * circumference : circumference;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-accent transition-colors relative"
          aria-label="Context window usage"
        >
          <svg className="w-5 h-5 transform -rotate-90" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r={radius}
              className="stroke-muted/30"
              strokeWidth="2.5"
              fill="transparent"
            />
            {usagePercent !== null && (
              <circle
                cx="12"
                cy="12"
                r={radius}
                className={`${strokeColor} transition-all duration-300 ease-in-out`}
                strokeWidth="2.5"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            )}
            {usagePercent === null && (
              <circle cx="12" cy="12" r="2" className="fill-muted-foreground" />
            )}
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-52 p-3 text-xs space-y-1.5">
        <p className="font-medium text-sm">Context Window</p>
        {usagePercent !== null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${strokeColor.replace('stroke-', 'bg-')}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <span className="font-mono tabular-nums">{usagePercent}%</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>Total tokens</span>
          <span className="font-mono tabular-nums">{totalTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Last turn</span>
          <span className="font-mono tabular-nums">{lastTokens.toLocaleString()}</span>
        </div>
        {cachedTokens > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Cached</span>
            <span className="font-mono tabular-nums">{cachedTokens.toLocaleString()}</span>
          </div>
        )}
        {modelContextWindow && (
          <div className="flex justify-between text-muted-foreground">
            <span>Limit</span>
            <span className="font-mono tabular-nums">{modelContextWindow.toLocaleString()}</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
