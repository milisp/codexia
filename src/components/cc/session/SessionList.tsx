import { DeleteSessionDialog } from '@/components/cc/session/DeleteSessionDialog';
import { SessionListItem } from '@/components/cc/session/SessionListItem';
import { DEFAULT_VISIBLE, useSessionPagination } from '@/components/cc/session/useSessionPagination';
import { useSessionActions } from '@/components/cc/session/useSessionActions';
import { useSessionSelection } from '@/components/cc/session/useSessionSelection';
import type { SdkSessionInfo } from '@/lib/sessions';
import { useCCStore } from '@/stores/cc';

interface Props {
  directory: string;
  sessions?: SdkSessionInfo[];
  onSelectSession?: (sessionId: string, project?: string) => void;
}

export function SessionList({ directory, sessions, onSelectSession }: Props) {
  const {
    loadedSessions,
    loading,
    loadingMore,
    error,
    expanded,
    setExpanded,
    totalCount,
    loadMoreSessions,
    removeSession,
  } = useSessionPagination({ directory, sessions });

  const { activeSessionIds, activeSessionId, isLoading, handleSessionClick } =
    useSessionSelection({ directory, onSelectSession });

  const { pendingDeleteId, setPendingDeleteId, doDeleteSession, doDeleteWorktree, copySessionId } =
    useSessionActions({ onSessionDeleted: removeSession });

  const { pendingNewSession } = useCCStore();

  const baseList = sessions ?? loadedSessions;
  // Prepend the optimistic pending session if it belongs to this directory and isn't in the list yet
  const hasPendingSession =
    pendingNewSession &&
    !baseList.some((s) => s.session_id === pendingNewSession.session_id) &&
    (pendingNewSession.cwd === directory || (!pendingNewSession.cwd && !directory));
  const allSessions = hasPendingSession ? [pendingNewSession!, ...baseList] : baseList;
  const visibleSessions = expanded ? allSessions : allSessions.slice(0, DEFAULT_VISIBLE);

  // effectiveTotal should account for the optimistic pending session
  // In controlled mode: sessions.length + (pending ? 1 : 0)
  // In uncontrolled mode: totalCount + (pending ? 1 : 0)
  const pendingCount = hasPendingSession ? 1 : 0;
  const effectiveTotal = (sessions !== undefined ? sessions.length : totalCount) + pendingCount;
  const allLoaded = allSessions.length >= effectiveTotal;
  // There's more to show if either: not yet expanded past the default page
  // (and more sessions exist beyond it), or expanded but not all fetched yet.
  const hasMore = effectiveTotal > DEFAULT_VISIBLE && (!expanded || !allLoaded);

  if (loading) {
    return <div className="text-sm text-muted-foreground p-2">Loading sessions...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive p-2">Error: {error}</div>;
  }

  if (allSessions.length === 0) {
    return <div className="text-sm text-muted-foreground p-2">No sessions in this project</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pr-2">
      <div className="min-h-0 flex-1">
        {visibleSessions.map((session) => (
          <SessionListItem
            key={session.session_id}
            session={session}
            isSelected={activeSessionId === session.session_id}
            isActive={activeSessionIds.includes(session.session_id)}
            isLoading={isLoading}
            onSelect={handleSessionClick}
            onCopyId={copySessionId}
            onDeleteWorktree={doDeleteWorktree}
            onRequestDelete={setPendingDeleteId}
          />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
          onClick={() => {
            if (expanded && allLoaded) {
              setExpanded(false);
              return;
            }
            void loadMoreSessions();
          }}
        >
          {loadingMore
            ? 'Loading...'
            : expanded && allLoaded
              ? 'Show less'
              : `Load more`}
        </button>
      )}

      <DeleteSessionDialog
        pendingDeleteId={pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        onConfirm={(id) => {
          void doDeleteSession(id);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
