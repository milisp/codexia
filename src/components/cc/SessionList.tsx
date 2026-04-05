import { useCallback, useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useCCStore } from '@/stores/cc';
import { getSessions, SessionData } from '@/lib/sessions';
import { ccGetSessionFilePath, ccDeleteSession } from '@/services/tauri/cc';
import { readTextFileLines } from '@/services/tauri/filesystem';
import { parseSessionJsonl } from '@/components/cc/utils/parseSessionJsonl';
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
import { isDesktopTauri } from '@/hooks/runtime';
import { formatThreadAge } from '@/utils/formatThreadAge';

interface Props {
  project?: string;
  sessions?: SessionData[];
  onSelectSession?: (sessionId: string, project?: string) => void;
}

export function ClaudeCodeSessionList({ project, sessions, onSelectSession }: Props) {
  const [loadedSessions, setLoadedSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(sessions === undefined);
  const [error, setError] = useState<string | null>(null);
  const { cwd, setCwd, setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { activeSessionIds, activeSessionId, isLoading, addMessageToSession, setSessionLoading, sessionMessagesMap } = useCCStore();
  const { toast } = useToast();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const fetched = await getSessions();
      setLoadedSessions(fetched);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessions !== undefined) {
      setLoading(false);
      setError(null);
      return;
    }
    void loadSessions();
  }, [loadSessions, sessions]);

  useEffect(() => {
    if (sessions !== undefined) {
      return;
    }

    const debounceMs = 150;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void loadSessions();
      }, debounceMs);
    };

    if (isDesktopTauri()) {
      let unlisten: (() => void) | null = null;
      void listen('session/list-updated', scheduleReload).then((dispose) => {
        unlisten = dispose;
      });
      return () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        unlisten?.();
      };
    }

    window.addEventListener('session/list-updated', scheduleReload);
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      window.removeEventListener('session/list-updated', scheduleReload);
    };
  }, [loadSessions, sessions]);

  const [expanded, setExpanded] = useState(false);
  const DEFAULT_VISIBLE = 3;

  const normalizedProject = useMemo(() => project?.replace(/\\/g, '/'), [project]);
  const allSessions = sessions ?? loadedSessions;
  const filteredSessions = useMemo(() => {
    if (!normalizedProject) {
      return allSessions;
    }
    return allSessions.filter((session) => session.project.replace(/\\/g, '/') === normalizedProject);
  }, [allSessions, normalizedProject]);
  const visibleSessions = expanded ? filteredSessions : filteredSessions.slice(0, DEFAULT_VISIBLE);
  const hasMore = filteredSessions.length > DEFAULT_VISIBLE;

  if (loading) {
    return <div className="text-sm text-muted-foreground p-2">Loading sessions...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive p-2">Error: {error}</div>;
  }

  const handleSessionClick = (session: SessionData) => {
    if (session.project && session.project !== cwd) {
      setCwd(session.project);
    }
    setSelectedAgent('cc');
    addAgentCard({ kind: 'cc', id: session.sessionId, preview: session.display });
    setCurrentAgentCardId(session.sessionId);
    setView('agent');
    if (onSelectSession) {
      onSelectSession(session.sessionId, session.project);
    }
    // Load JSONL history immediately so the card shows messages without requiring "Resume".
    const sid = session.sessionId;
    if (!sessionMessagesMap[sid]?.length) {
      void (async () => {
        const filePath = await ccGetSessionFilePath(sid);
        if (!filePath) return;
        const lines = await readTextFileLines(filePath);
        for (const msg of parseSessionJsonl(lines, sid)) {
          addMessageToSession(sid, msg);
        }
        setSessionLoading(sid, false);
      })();
    }
  };

  const doDeleteSession = async (sessionId: string) => {
    try {
      await ccDeleteSession(sessionId);
      setLoadedSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch {
      toast({ description: 'Failed to delete session', variant: 'destructive' });
    }
  };

  const doDeleteWorktree = async (session: SessionData) => {
    if (!session.project.includes('/.codexia/worktrees/')) return;
    const worktreeKey = session.project.split('/').pop() ?? '';
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

  if (filteredSessions.length === 0) {
    return <div className="text-sm text-muted-foreground p-2">No sessions in this project</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pr-2">
      <div className="min-h-0 flex-1">
        {visibleSessions.map((session) => {
          const isSelected = activeSessionId === session.sessionId;
          const isActive = activeSessionIds.includes(session.sessionId);
          return (
            <div
              key={session.sessionId}
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
                {session.display}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                <span className="group-hover:hidden">{formatThreadAge(session.timestamp)}</span>
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
                    <DropdownMenuItem onClick={(e) => copySessionId(e, session.sessionId)}>
                      <Copy className="h-3 w-3" />
                      <span>Copy Session ID</span>
                    </DropdownMenuItem>
                    {session.project.includes('/.codexia/worktrees/') && (
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
                        setPendingDeleteId(session.sessionId);
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
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? `Show less` : `Show ${filteredSessions.length - DEFAULT_VISIBLE} more`}
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
