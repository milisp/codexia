import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Archive, GitFork, FolderX, Loader2 } from 'lucide-react';
import { useThreadFilter } from '@/components/codex/hooks/useThreadFilter';
import { codexService } from '@/services/codexService';
import { useCodexStore, useThreadListStore } from '@/components/codex/stores';
import { deleteFile, readSessionMetaFile, threadList, writeSessionMetaFile } from '@/services/tauri';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { formatThreadAge } from '@/utils/formatThreadAge';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { ThreadListItem } from '@/types/codex/ThreadListItem';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
import { gitRemoveWorktree } from '@/services/tauri/git';
import { toast } from '@/components/ui/use-toast';

type SessionMetaEntry = {
  text?: string;
};

interface ThreadListProps {
  cwdOverride?: string;
}

export function ThreadList({ cwdOverride }: ThreadListProps = {}) {
  const { cwd, historyMode, setCwd, setHistoryMode } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { threads, currentThreadId, threadListNextCursor, threadStatusMap } = useCodexStore();
  const { searchTerm, sortKey } = useThreadListStore();
  const isProjectScoped = !!cwdOverride;
  const listCwd = cwdOverride ?? cwd;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [scopedThreads, setScopedThreads] = useState<ThreadListItem[]>([]);
  const [scopedNextCursor, setScopedNextCursor] = useState<string | null>(null);
  const reloadScopedThreadsRef = useRef<(() => Promise<void>) | null>(null);
  const [sessionMeta, setSessionMeta] = useState<Record<string, SessionMetaEntry>>({});
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const sourceThreads = isProjectScoped ? scopedThreads : threads;
  const nextCursor = isProjectScoped ? scopedNextCursor : threadListNextCursor;
  const mergedThreads = useMemo(
    () =>
      sourceThreads.map((thread) => ({
        ...thread,
        preview: sessionMeta[thread.id]?.text ?? thread.preview,
      })),
    [sessionMeta, sourceThreads]
  );
  const filteredThreads = useThreadFilter(mergedThreads, searchTerm);
  const sortedThreads = useMemo(() => {
    return filteredThreads.map((thread) => thread);
  }, [filteredThreads]);
  const loadSessionMeta = useCallback(async () => {
    try {
      const raw = await readSessionMetaFile();
      const parsed = JSON.parse(raw) as Record<string, SessionMetaEntry>;
      if (parsed && typeof parsed === 'object') {
        setSessionMeta(parsed);
      } else {
        setSessionMeta({});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const normalized = message.toLowerCase();
      if (
        normalized.includes('no such file or directory') ||
        normalized.includes('os error 2') ||
        normalized.includes('file does not exist')
      ) {
        setSessionMeta({});
      } else {
        console.error('Failed to load session meta:', err);
      }
    }
  }, []);
  const writeSessionMeta = useCallback(async (nextMeta: Record<string, SessionMetaEntry>) => {
    await writeSessionMetaFile(JSON.stringify(nextMeta, null, 2));
    setSessionMeta(nextMeta);
  }, []);

  useEffect(() => {
    void loadSessionMeta();
  }, [loadSessionMeta]);

  useEffect(() => {
    if (!isProjectScoped) {
      reloadScopedThreadsRef.current = null;
      return;
    }
    let cancelled = false;

    const loadScopedThreads = async () => {
      try {
        const params = {
          cursor: null,
          limit: 3,
          modelProviders: null,
          sortKey,
          archived: false,
          sourceKinds: null,
        };
        const response = await threadList(params, listCwd);
        if (cancelled) {
          return;
        }
        const loadedThreads = response.data.map((t) => codexService.normalizeThreadItem(t));
        const next =
          (response as { nextCursor?: string | null }).nextCursor ??
          (response as { next_cursor?: string | null }).next_cursor ??
          null;
        setScopedThreads(loadedThreads);
        setScopedNextCursor(next);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load scoped thread list:', error);
        }
      }
    };

    reloadScopedThreadsRef.current = loadScopedThreads;

    void loadScopedThreads();
    return () => {
      cancelled = true;
    };
  }, [isProjectScoped, listCwd, sortKey]);

  useEffect(() => {
    if (!isProjectScoped) {
      return;
    }

    setScopedThreads((prev) => {
      const globalById = new Map(threads.map((thread) => [thread.id, thread]));
      let changed = false;
      const next = prev.map((thread) => {
        const globalThread = globalById.get(thread.id);
        if (!globalThread) {
          return thread;
        }
        if (
          globalThread.preview === thread.preview &&
          globalThread.cwd === thread.cwd &&
          globalThread.path === thread.path &&
          globalThread.source === thread.source &&
          globalThread.createdAt === thread.createdAt &&
          globalThread.updatedAt === thread.updatedAt
        ) {
          return thread;
        }
        changed = true;
        return globalThread;
      });

      if (listCwd === cwd && currentThreadId) {
        const activeThread = globalById.get(currentThreadId);
        if (activeThread && !next.some((thread) => thread.id === activeThread.id)) {
          changed = true;
          next.unshift(activeThread);
        }
      }

      return changed ? next : prev;
    });
  }, [cwd, currentThreadId, isProjectScoped, listCwd, threads]);


  const handleSelectThread = useCallback(
    async (threadId: string, options?: { resume?: boolean }) => {
      if (threadId === currentThreadId) {
        return;
      }
      if (listCwd && listCwd !== cwd) {
        setCwd(listCwd);
      }
      const shouldResume = options?.resume ?? !historyMode;
      await codexService.setCurrentThread(threadId, { resume: shouldResume });
    },
    [currentThreadId, cwd, historyMode, listCwd, setCwd]
  );

  const handleOpenThreadFromList = useCallback(
    async (threadId: string, preview?: string) => {
      if (historyMode) {
        setView('history');
        await handleSelectThread(threadId, { resume: false });
        return;
      }

      setHistoryMode(false);
      addAgentCard({ kind: 'codex', id: threadId, preview, cwd: listCwd });
      setCurrentAgentCardId(threadId);
      setView('agent');
      await handleSelectThread(threadId, { resume: true });
    },
    [handleSelectThread, historyMode, setHistoryMode, setView, setCurrentAgentCardId, addAgentCard]
  );

  const handleArchiveThread = useCallback(
    async (threadId: string) => {
      await codexService.archiveThread(threadId);
      if (isProjectScoped) {
        const params = {
          cursor: null,
          limit: 20,
          modelProviders: null,
          sortKey,
          archived: false,
          sourceKinds: null,
        };
        const response = await threadList(params, listCwd);
        const loadedThreads = response.data.map((t) => codexService.normalizeThreadItem(t));
        const next =
          (response as { nextCursor?: string | null }).nextCursor ??
          (response as { next_cursor?: string | null }).next_cursor ??
          null;
        setScopedThreads(loadedThreads);
        setScopedNextCursor(next);
      } else {
        await codexService.loadThreads(cwd, false, sortKey);
      }
    },
    [cwd, isProjectScoped, listCwd, sortKey]
  );

  const handleForkThread = useCallback(
    async (threadId: string) => {
      const preview = mergedThreads.find((t) => t.id === threadId)?.preview;
      await codexService.threadFork(threadId);
      addAgentCard({ kind: 'codex', id: threadId, preview, cwd: listCwd });
      setCurrentAgentCardId(threadId);
      setView('agent');
      if (isProjectScoped) {
        await reloadScopedThreadsRef.current?.();
      }
    },
    [isProjectScoped, setView, mergedThreads, addAgentCard, setCurrentAgentCardId]
  );

  const handleDeleteWorktree = useCallback(async (thread: ThreadListItem) => {
    const { cwd: mainCwd } = useWorkspaceStore.getState();
    if (!mainCwd || !thread.cwd.includes('/.codexia/worktrees/')) return;
    const worktreeKey = thread.cwd.split('/').pop() ?? '';
    try {
      await gitRemoveWorktree(mainCwd, worktreeKey);
      toast.success('Worktree deleted');
    } catch (err) {
      toast.error('Failed to delete worktree', { description: String(err) });
    }
  }, []);

  const handleDeleteThreadByPath = useCallback(
    async (threadId: string, threadPath: string) => {
      if (!threadPath) {
        return;
      }

      await deleteFile(threadPath);

      if (sessionMeta[threadId]) {
        const nextMeta = { ...sessionMeta };
        delete nextMeta[threadId];
        await writeSessionMeta(nextMeta);
      }

      if (currentThreadId === threadId) {
        await codexService.setCurrentThread(null, { resume: false });
      }

      if (isProjectScoped) {
        const params = {
          cursor: null,
          limit: 20,
          modelProviders: null,
          sortKey,
          archived: false,
          sourceKinds: null,
        };
        const response = await threadList(params, listCwd);
        const loadedThreads = response.data.map((t) => codexService.normalizeThreadItem(t));
        const next =
          (response as { nextCursor?: string | null }).nextCursor ??
          (response as { next_cursor?: string | null }).next_cursor ??
          null;
        setScopedThreads(loadedThreads);
        setScopedNextCursor(next);
      } else {
        await codexService.loadThreads(cwd, false, sortKey);
      }
    },
    [
      currentThreadId,
      cwd,
      isProjectScoped,
      listCwd,
      sessionMeta,
      sortKey,
      writeSessionMeta,
    ]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      if (isProjectScoped) {
        const params = {
          cursor: nextCursor,
          limit: 20,
          modelProviders: null,
          sortKey,
          archived: false,
          sourceKinds: null,
        };
        const response = await threadList(params, listCwd);
        const loadedThreads = response.data.map((t) => codexService.normalizeThreadItem(t));
        const next =
          (response as { nextCursor?: string | null }).nextCursor ??
          (response as { next_cursor?: string | null }).next_cursor ??
          null;
        setScopedThreads((prev) => {
          const seen = new Set(prev.map((thread) => thread.id));
          const merged = [...prev];
          for (const thread of loadedThreads) {
            if (!seen.has(thread.id)) {
              seen.add(thread.id);
              merged.push(thread);
            }
          }
          return merged;
        });
        setScopedNextCursor(next);
      } else {
        await codexService.loadMoreThreads(cwd, sortKey);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [cwd, isLoadingMore, isProjectScoped, listCwd, nextCursor, sortKey]);

  const openRenameDialog = useCallback(
    (threadId: string) => {
      const meta = sessionMeta[threadId];
      const matchedThread = mergedThreads.find((t) => t.id === threadId);
      const displayName = meta?.text ?? matchedThread?.preview ?? '';
      setRenameThreadId(threadId);
      setRenameValue(displayName);
    },
    [mergedThreads, sessionMeta]
  );

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, thread: { id: string; preview?: string }) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void handleOpenThreadFromList(thread.id, thread.preview);
      }
    },
    [handleOpenThreadFromList]
  );

  const handleRenameSubmit = useCallback(async () => {
    if (!renameThreadId) {
      return;
    }
    const trimmed = renameValue.trim();
    const nextMeta = { ...sessionMeta };
    if (!trimmed) {
      delete nextMeta[renameThreadId];
    } else {
      nextMeta[renameThreadId] = {
        ...(nextMeta[renameThreadId] ?? {}),
        text: trimmed,
      };
    }
    await writeSessionMeta(nextMeta);
    setRenameThreadId(null);
  }, [renameThreadId, renameValue, sessionMeta, writeSessionMeta]);

  return (
    <div className="flex min-h-0 flex-1 flex-col pr-2">
      <div className="min-h-0 flex-1">
        {sortedThreads.map((thread) => (
          <ContextMenu key={thread.id}>
            <ContextMenuTrigger asChild>
              <div
                onClick={() => {
                  void handleOpenThreadFromList(thread.id, thread.preview);
                }}
                onKeyDown={(event) => handleRowKeyDown(event, thread)}
                role="button"
                tabIndex={0}
                className={`group grid grid-cols-[1fr_auto] items-center gap-2 w-full text-left p-2 rounded-lg transition-colors ${currentThreadId === thread.id ? 'bg-zinc-700/50' : 'hover:bg-zinc-800/30'
                  }`}
              >
                <div className="text-sm font-medium truncate min-w-0 pr-2 flex items-center gap-1.5">
                  {threadStatusMap[thread.id]?.type === 'active' && (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {thread.preview}
                </div>
                <div className="flex items-center justify-end h-6 w-12 relative">
                  <span className="text-xs text-muted-foreground whitespace-nowrap group-hover:hidden">
                    {formatThreadAge(thread.createdAt ?? 0)}
                  </span>
                  <button
                    type="button"
                    aria-label="Archive thread"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleArchiveThread(thread.id);
                    }}
                    className="absolute right-0 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent/50 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 max-md:opacity-100"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">
              <ContextMenuItem onSelect={() => openRenameDialog(thread.id)}>
                Rename
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void handleForkThread(thread.id)}>
                <GitFork className="mr-2 h-4 w-4" />
                Fork
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void handleArchiveThread(thread.id)}>
                Archive
              </ContextMenuItem>
              {thread.cwd.includes('/.codexia/worktrees/') && (
                <ContextMenuItem
                  onSelect={() => void handleDeleteWorktree(thread)}
                >
                  <FolderX className="mr-2 h-4 w-4" />
                  Delete Worktree
                </ContextMenuItem>
              )}
              <ContextMenuItem
                variant="destructive"
                onSelect={() => void handleDeleteThreadByPath(thread.id, thread.path ?? '')}
              >
                Delete
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(thread.id)}>
                Copy Id
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
        {filteredThreads.length === 0 && (
          <div className="text-center text-sm text-sidebar-foreground/50 py-8 px-4">
            {searchTerm ? 'No matching tasks.' : 'No tasks yet.'}
          </div>
        )}
      </div>
      {nextCursor ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="justify-start"
        >
          {isLoadingMore ? 'Loading more…' : 'Load more'}
        </Button>
      ) : null}
      <Dialog
        open={!!renameThreadId}
        onOpenChange={(open) => (!open ? setRenameThreadId(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename thread</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder="Thread name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameThreadId(null)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}