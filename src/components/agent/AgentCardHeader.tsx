import { X } from 'lucide-react';
import { AgentIcon } from '@/components/common/AgentIcon';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';

type AgentStatus = 'running' | 'pending' | 'idle';

interface AgentCardHeaderProps {
  card: AgentCenterCard;
  onClose?: () => void;
  onSelect?: () => void;
  status?: AgentStatus;
}
export function AgentCardHeader({
  card,
  onClose,
  onSelect,
  status = 'idle',
}: AgentCardHeaderProps) {
  const title = card.preview?.slice(0, 60) || card.id.slice(0, 12);

  const dotColor =
    status === 'running'
      ? 'bg-green-500'
      : status === 'pending'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/40';

  const dotAnimate = status !== 'idle' ? 'animate-pulse' : '';

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/30 shrink-0"
      onClick={onSelect}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    >
      {onClose && (
        // Shows a status dot by default; reveals the X button on hover.
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="group relative h-3.5 w-3.5 flex items-center justify-center shrink-0"
          aria-label="Remove"
        >
          <span
            className={`absolute h-2 w-2 rounded-full transition-opacity duration-150 group-hover:opacity-0 ${dotColor} ${dotAnimate}`}
          />
          <X className="h-3.5 w-3.5 text-destructive/60 hover:text-destructive absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        </button>
      )}
      <AgentIcon agent={card.kind} />
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{title}</span>
    </div>
  );
}
