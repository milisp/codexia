import { useCallback, useEffect, useState } from 'react';
import { useCCStore } from '@/stores/cc';
import { listSessions, type SdkSessionInfo } from '@/lib/sessions';
import { ccGetSessionMessages, ccDeleteSession } from '@/services/tauri/cc';
import { fromSdkMessages } from '@/components/cc/utils/fromSdkMessages';
import { MoreVertical, Copy, Loader2, Trash2, FolderX } from 'lucide-react';
import { gitRemoveWorktree } from '@/services/tauri/git';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { formatThreadAge } from '@/utils/formatThreadAge';

const DEFAULT_VISIBLE = 3;
const LOAD_MORE_SIZE = 20;

interface Props {
  directory: string;
  sessions?: SdkSessionInfo[];
  onSelectSession?: (sessionId: string, project?: string) => void;
}

export function ClaudeCodeSessionList({ directory, sessions, onSelectSession }: Props) {
  const [loadedSessions, setLoadedSessions] = useState<SdkSessionInfo[]>([]);
  const [loading, setLoading] = useState(sessions === undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setCwd, setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { activeSessionIds, activeSessionId, isLoading, addMessageToSession, setSessionLoading, sessionMessagesMap, pendingNewSession, setPendingNewSession } = useCCStore();
  const { toast } = useToast();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const loadSessions = useCallback(async () => {
    if (!directory) {
      setLoadedSessions([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { sessions: fetched, total } = await listSessions(directory, {
        limit: DEFAULT_VISIBLE,
        includeWorktrees: true,
      });
      setLoadedSessions(fetched);
      setTotalCount(total);
      // Once the real list is fetched, clear the optimistic pending session
      setPendingNewSession(null);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [directory]);

  const loadMoreSessions = useCallback(async () => {
    if (!directory) return;
    setLoadingMore(true);
    try {
      const { sessions: extra } = await listSessions(directory, {
        limit: LOAD_MORE_SIZE,
        offset: loadedSessions.length,
        includeWorktrees: true,
      });
      setLoadedSessions((prev) => [...prev, ...extra]);
      setExpanded(true);
    } finally {
      setLoadingMore(false);
    }
  }, [directory, loadedSessions.length]);

  useEffect(() => {
    if (sessions !== undefined) {
      setLoading(false);
      setError(null);
      return;
    }
    void loadSessions();
  }, [loadSessions, sessions]);

  const [expanded, setExpanded] = useState(false);

  const baseList = sessions ?? loadedSessions;
  // Prepend the optimistic pending session if it belongs to this directory and isn't in the list yet
  const allSessions =
    pendingNewSession &&
    !baseList.some((s) => s.session_id === pendingNewSession.session_id) &&
    (pendingNewSession.cwd === directory || (!pendingNewSession.cwd && !directory))
      ? [pendingNewSession, ...baseList]
      : baseList;
  const visibleSessions = expanded ? allSessions : allSessions.slice(0, DEFAULT_VISIBLE);
  const effectiveTotal = sessions !== undefined ? sessions.length : totalCount;
  const allLoaded = allSessions.length >= effectiveTotal;
  const hasMore = effectiveTotal > DEFAULT_VISIBLE;

  if (loading) {
    return <div className="text-sm text-muted-foreground p-2">Loading sessions...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive p-2">Error: {error}</div>;
  }

  const handleSessionClick = (session: SdkSessionInfo) => {
    const sessionProject = session.cwd ?? '';
    if (sessionProject && sessionProject !== directory) {
      setCwd(sessionProject);
    }
    setSelectedAgent('cc');
    addAgentCard({ kind: 'cc', id: session.session_id, preview: session.summary, cwd: sessionProject || directory });
    setCurrentAgentCardId(session.session_id);
    setView('agent');
    if (onSelectSession) {
      onSelectSession(session.session_id, sessionProject);
    }
    // Load JSONL history immediately so the card shows messages without requiring "Resume".
    const sid = session.session_id;
    if (!sessionMessagesMap[sid]?.length) {
      void (async () => {
        const sdkMessages = await ccGetSessionMessages(sid);
        for (const msg of fromSdkMessages(sdkMessages, sid)) {
          addMessageToSession(sid, msg);
        }
        setSessionLoading(sid, false);
      })();
    }
  };

  const doDeleteSession = async (sessionId: string) => {
    try {
      await ccDeleteSession(sessionId);
      setLoadedSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch {
      toast({ description: 'Failed to delete session', variant: 'destructive' });
    }
  };

  const doDeleteWorktree = async (session: SdkSessionInfo) => {
    const sessionProject = session.cwd ?? '';
    if (!sessionProject.includes('/.codexia/worktrees/')) return;
    const worktreeKey = sessionProject.split('/').pop() ?? '';
    const mainCwd = useWorkspaceStore.getState().cwd;
    if (!mainCwd) return;
    try {
      await gitRemoveWorktree(mainCwd, worktreeKey);
      toast({ description: 'Worktree deleted' });
    } catch {
      toast({ description: 'Failed to delete worktree', variant: 'destructive' });
    }
  };

  const copySessionId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast({
      description: 'Session ID copied to clipboard',
    });
  };

  if (allSessions.length === 0) {
    return <div className="text-sm text-muted-foreground p-2">No sessions in this project</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pr-2">
      <div className="min-h-0 flex-1">
        {visibleSessions.map((session) => {
          const isSelected = activeSessionId === session.session_id;
          const isActive = activeSessionIds.includes(session.session_id);
          return (
            <div
              key={session.session_id}
              role="button"
              tabIndex={0}
              className={`group relative grid grid-cols-[0.5rem_1fr_auto] items-center gap-3 w-full text-left p-2 rounded-lg transition-colors cursor-pointer ${isSelected ? 'bg-zinc-700/50' : 'hover:bg-zinc-800/30'
                }`}
              onClick={() => handleSessionClick(session)}
            >
              <div className="relative h-6 flex items-center justify-center">
                {isActive && isSelected && isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-green-500 animate-spin shrink-0" />
                ) : isActive ? (
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                ) : null}
              </div>

              <div
                className={`text-sm font-medium truncate min-w-0 ${isSelected ? 'text-primary' : 'text-inherit'}`}
              >
                {session.summary}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                <span className="group-hover:hidden">{formatThreadAge(Math.floor(session.last_modified / 1000))}</span>
              </div>

              <div className="absolute right-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded hover:bg-accent/50 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 max-md:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => copySessionId(e, session.session_id)}>
                      <Copy className="h-3 w-3" />
                      <span>Copy Session ID</span>
                    </DropdownMenuItem>
                    {(session.cwd ?? '').includes('/.codexia/worktrees/') && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          void doDeleteWorktree(session);
                        }}
                      >
                        <FolderX className="h-3 w-3" />
                        <span>Delete Worktree</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(session.session_id);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
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
              : `Show ${Math.min(LOAD_MORE_SIZE, effectiveTotal - allSessions.length)} more`}
        </button>
      )}

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The session and its history will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) {
                  void doDeleteSession(pendingDeleteId);
                  setPendingDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
