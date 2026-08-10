import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAcpStore } from '@/stores/useAcpStore';
import { formatThreadAge } from '@/utils/formatThreadAge';
import { useAcpSessions } from './useAcpSessions';

/** Sidebar list of persisted ACP sessions for one project. */
export function AcpSessionList({ directory }: { directory: string }) {
  const { sessions, opening, open, remove } = useAcpSessions(directory);
  const sessionId = useAcpStore((s) => s.sessionId);

  if (sessions.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">No ACP sessions yet.</div>;
  }

  return (
    <div className="px-2 py-1 space-y-0.5">
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          role="button"
          tabIndex={0}
          onClick={() => open(session)}
          className={`group relative flex items-center gap-2 w-full text-left p-2 rounded-lg cursor-pointer transition-colors ${
            session.sessionId === sessionId ? 'bg-zinc-700/50' : 'hover:bg-zinc-800/30'
          }`}
        >
          {opening === session.sessionId && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{session.title ?? 'New session'}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {session.agentTitle ?? session.agentId}
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground group-hover:hidden">
            {formatThreadAge(Math.floor(new Date(session.updatedAt).getTime() / 1000))}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              void remove(session);
            }}
            title="Delete session"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
