import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Archive, GitFork, Pin, FolderX } from 'lucide-react';
import { useThreadFilter } from '@/hooks/codex/useThreadFilter';
import { codexService } from '@/services/codexService';
import { useCodexStore, useThreadListStore } from '@/stores/codex';
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
  pinned_at_ms?: number | null;
};

interface ThreadListProps {
  cwdOverride?: string;
}

export function ThreadList({ cwdOverride }: ThreadListProps = {}) {
  const { cwd, historyMode, setCwd, setHistoryMode } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { threads, currentThreadId, threadListNextCursor } = useCodexStore();
  const { searchTerm, sortKey } = useThreadListStore();
  const isProjectScoped = !!cwdOverride;
  const listCwd = cwdOverride ?? cwd;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [scopedThreads, setScopedThreads] = useState<ThreadListItem[]>([]);
  const [scopedNextCursor, setScopedNextCursor] = useState<string | null>(null);
  // Stable ref so the event listener callback always calls the latest fetch
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
        pinnedAtMs: sessionMeta[thread.id]?.pinned_at_ms ?? null,
      })),
    [sessionMeta, sourceThreads]
  );
  const filteredThreads = useThreadFilter(mergedThreads, searchTerm);
  const sortedThreads = useMemo(() => {
    // Keep backend order (already sorted by sortKey) and only lift pinned rows.
    const withIndex = filteredThreads.map((thread, index) => ({ thread, index }));
    withIndex.sort((a, b) => {
      const aPinned = a.thread.pinnedAtMs ?? -1;
      const bPinned = b.thread.pinnedAtMs ?? -1;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      return a.index - b.index;
    });
    return withIndex.map((item) => item.thread);
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

    // Keep the ref up-to-date so the event listener below can call the latest version
    reloadScopedThreadsRef.current = loadScopedThreads;

    void loadScopedThreads();
    return () => {
      cancelled = true;
    };
  }, [isProjectScoped, listCwd, sortKey]);


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

  const handleTogglePin = useCallback(
    async (threadId: string) => {
      const meta = sessionMeta[threadId];
      const isPinned = !!meta?.pinned_at_ms;
      const nextMeta = { ...sessionMeta };
      if (isPinned) {
        if (nextMeta[threadId]) {
          const { text } = nextMeta[threadId];
          if (text) {
            nextMeta[threadId] = { text, pinned_at_ms: null };
          } else {
            delete nextMeta[threadId];
          }
        }
      } else {
        nextMeta[threadId] = {
          ...(nextMeta[threadId] ?? {}),
          pinned_at_ms: Date.now(),
        };
      }
      await writeSessionMeta(nextMeta);
    },
    [sessionMeta, writeSessionMeta]
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
      if (nextMeta[renameThreadId]) {
        const { pinned_at_ms } = nextMeta[renameThreadId];
        if (pinned_at_ms) {
          nextMeta[renameThreadId] = { pinned_at_ms };
        } else {
          delete nextMeta[renameThreadId];
        }
      }
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
                className={`group relative grid grid-cols-[0.5rem_1fr_auto] items-center gap-3 w-full text-left p-2 rounded-lg transition-colors ${currentThreadId === thread.id ? 'bg-zinc-700/50' : 'hover:bg-zinc-800/30'
                  }`}
              >
                <div className="relative h-6">
                  <button
                    type="button"
                    aria-label={thread.pinnedAtMs ? 'Unpin thread' : 'Pin thread'}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleTogglePin(thread.id);
                    }}
                    className={`absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent/50 transition-colors ${thread.pinnedAtMs ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 max-md:opacity-100'
                      } ${thread.pinnedAtMs ? 'text-foreground' : 'text-muted-foreground/40'}`}
                  >
                    <Pin className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-sm font-medium truncate min-w-0 text-inherit">
                  {thread.preview}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                  <span className="group-hover:hidden">{formatThreadAge(thread.createdAt ?? 0)}</span>
                </div>
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
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">
              <ContextMenuItem onSelect={() => openRenameDialog(thread.id)}>
                Rename
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void handleTogglePin(thread.id)}>
                {thread.pinnedAtMs ? 'Unpin' : 'Pin'}
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
