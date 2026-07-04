import { Badge } from '@/components/ui/badge';
import type { RateLimitEvent } from '../../types/messages';

interface Props {
  msg: RateLimitEvent;
}

export function RateLimitCard({ msg }: Props) {
  const info = msg.rate_limit_info;

  if (!info.isUsingOverage) return null;

  const resetsAt = info.resetsAt ? new Date(info.resetsAt * 1000).toLocaleTimeString() : null;

  return (
    <Badge
      variant="outline"
      className="border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-600 gap-1"
    >
      <span>Rate limit overage active</span>
      {resetsAt && <span className="opacity-70">· resets {resetsAt}</span>}
    </Badge>
  );
}
