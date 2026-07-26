import { CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AgentBadge({
  label,
  active,
  loading,
  onClick,
}: {
  label: string;
  active: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      title={active ? `Unlink from ${label}` : `Link to ${label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-muted text-muted-foreground hover:border-muted-foreground/50',
        loading && 'cursor-not-allowed opacity-50'
      )}
    >
      {loading ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : active ? (
        <CheckCircle className="h-2.5 w-2.5" />
      ) : null}
      {label}
    </button>
  );
}
