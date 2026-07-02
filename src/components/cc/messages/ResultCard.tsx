import { Badge } from '@/components/ui/badge';
import type { ResultMessage } from '../types/messages';

interface Props {
  msg: ResultMessage;
}

export function ResultCard({ msg }: Props) {
  return (
    <>
      <div className="text-emerald-900/80 dark:text-emerald-100/80">
        {msg.is_error && <span className="ml-2 text-red-500 italic">Error occurred</span>}
      </div>
      <Badge>
        {(msg.duration_ms / 1000).toFixed(2)}s · {msg.num_turns} turns
        {msg.total_cost_usd ? ` · $${msg.total_cost_usd.toFixed(4)}` : ''}
      </Badge>
    </>
  );
}
