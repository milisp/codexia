import { listen } from '@tauri-apps/api/event';
import { Archive, FolderX, GitFork, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type {
  Thread,
  ThreadListParams,
  ThreadListResponse,
  ThreadNameUpdatedNotification,
} from '@/bindings/v2';
import { RenameThreadDialog } from '@/components/codex/RenameThreadDialog';
import { useCodexStore, useThreadListStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from '@/components/ui/use-toast';
import { codexService } from '@/services/codexService';
import { deleteThread, listThreads, renameThread } from '@/services/tauri';
import { gitRemoveWorktree } from '@/services/tauri/git';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { formatThreadAge } from '@/utils/formatThreadAge';

interface ThreadListProps {
  cwd: string;
}
export const modelProviders = ['openai', 'atlascloud', 'ollama', 'openrouter', 'nvidia', 'custom'];

const EMPTY_LIST: ThreadListResponse = { data: [], nextCursor: null, backwardsCursor: null };

export function ThreadList({ cwd }: ThreadListProps) {
  const { cwd: workspaceCwd, historyMode, setCwd, setHistoryMode } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { currentThreadId, threadStatusMap, threads: storeThreads } = useCodexStore();
  const { searchTerm, sortKey } = useThreadListStore();
  const [response, setResponse] = useState<ThreadListResponse>(EMPTY_LIST);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const threads = response.data;
  const nextCursor = response.nextCursor;

  // Track previous storeThreads to detect new threads inline during render
  const prevStoreThreadsRef = useRef<Thread[]>([]);
  if (storeThreads.length > 0) {
    const localIds = new Set(response.data.map((t) => t.id));
    const hasNew = storeThreads.some((t) => t.cwd === cwd && !localIds.has(t.id));
    if (hasNew && storeThreads.length !== prevStoreThreadsRef.current.length) {
      prevStoreThreadsRef.current = storeThreads;
      setRefreshTrigger((prev) => prev + 1);
    }
  }

  // --- Thread loading (search + sort delegated to backend) ---

  useEffect(() => {
    let cancelled = false;
    const params: ThreadListParams = {
      cursor: null,
      limit: refreshCounter > 0 ? 20 : 3,
      modelProviders: modelProviders,
      sortKey,
      archived: false,
      cwd,
      useStateDbOnly: true,
      searchTerm: searchTerm || null,
    };
    const load = async () => {
      try {
        const res = await listThreads(params);
        if (cancelled) return;
        setResponse(res);
      } catch (err) {
        if (!cancelled) console.error('Failed to load threads:', err);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [cwd, sortKey, searchTerm, refreshCounter]);

  const refresh = useCallback(() => setRefreshCounter((n) => n + 1), []);

  // When a new thread is created in the store (e.g. after threadStart),
  // refresh the list so the sidebar reflects it immediately.
  useEffect(() => {
    if (refreshTrigger === 0) return;
    refresh();
  }, [refreshTrigger, refresh]);

  // Patch thread name when thread/name/updated notification arrives.
  useEffect(() => {
    const unlisten = listen<ServerNotification>('codex:notification', (event) => {
      const { method, params } = event.payload;
      if (method !== 'thread/name/updated') return;
      const { threadId, threadName } = params as ThreadNameUpdatedNotification;
      setResponse((prev) => ({
        ...prev,
        data: prev.data.map((t) => (t.id === threadId ? { ...t, name: threadName ?? null } : t)),
      }));
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // --- Thread actions ---

  const handleSelectThread = useCallback(
    async (threadId: string, options?: { resume?: boolean }) => {
      if (threadId === currentThreadId) return;
      if (cwd !== workspaceCwd) setCwd(cwd);
      await codexService.setCurrentThread(threadId, { resume: options?.resume ?? !historyMode });
    },
    [currentThreadId, cwd, historyMode, workspaceCwd, setCwd]
  );

  const handleOpenThread = useCallback(
    async (threadId: string, preview?: string) => {
      if (historyMode) {
        setView('history');
        await handleSelectThread(threadId, { resume: false });
        return;
      }
      setHistoryMode(false);
      addAgentCard({ kind: 'codex', id: threadId, preview, cwd });
      setCurrentAgentCardId(threadId);
      setView('agent');
      await handleSelectThread(threadId, { resume: true });
    },
    [
      handleSelectThread,
      historyMode,
      setHistoryMode,
      setView,
      setCurrentAgentCardId,
      addAgentCard,
      cwd,
    ]
  );

  const handleArchive = useCallback(
    async (threadId: string) => {
      await codexService.archiveThread(threadId);
      refresh();
    },
    [refresh]
  );

  const handleFork = useCallback(
    async (threadId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      await codexService.threadFork(threadId);
      addAgentCard({ kind: 'codex', id: threadId, preview: thread?.preview, cwd });
      setCurrentAgentCardId(threadId);
      setView('agent');
      refresh();
    },
    [cwd, threads, addAgentCard, setCurrentAgentCardId, setView, refresh]
  );

  const handleDeleteWorktree = useCallback(async (thread: Thread) => {
    const { cwd: mainCwd } = useWorkspaceStore.getState();
    if (!mainCwd || !thread.cwd.includes('/.codexia/worktrees/')) return;
    const key = thread.cwd.split('/').pop() ?? '';
    try {
      await gitRemoveWorktree(mainCwd, key);
      toast.success('Worktree deleted');
    } catch (err) {
      toast.error('Failed to delete worktree', { description: String(err) });
    }
  }, []);

  const handleDelete = useCallback(
    async (threadId: string) => {
      await deleteThread(threadId);
      if (currentThreadId === threadId) {
        await codexService.setCurrentThread(null, { resume: false });
      }
      refresh();
    },
    [currentThreadId, refresh]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const params: ThreadListParams = {
        cursor: nextCursor,
        limit: 20,
        modelProviders: modelProviders,
        useStateDbOnly: true,
        sortKey,
        cwd,
        searchTerm: searchTerm || null,
      };
      const res = await listThreads(params);
      setResponse((prev) => {
        const seen = new Set(prev.data.map((t) => t.id));
        return {
          ...res,
          data: [...prev.data, ...res.data.filter((t) => !seen.has(t.id))],
        };
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [cwd, isLoadingMore, nextCursor, sortKey, searchTerm]);

  const openRenameDialog = useCallback((thread: Thread) => {
    // Prefer explicit name, fall back to preview (first message).
    setRenameThreadId(thread.id);
    setRenameValue(thread.name ?? thread.preview);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameThreadId || !renameValue.trim()) return;
    await renameThread(renameThreadId, renameValue.trim());
    setRenameThreadId(null);
    // thread/name/updated notification patches response.data directly.
  }, [renameThreadId, renameValue]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        {threads.map((thread) => (
          <ContextMenu key={thread.id}>
            <ContextMenuTrigger asChild>
              <div
                onClick={() => void handleOpenThread(thread.id, thread.preview)}
                role="button"
                tabIndex={0}
                className={`group grid grid-cols-[1fr_auto] items-center gap-2 w-full text-left p-2 rounded-lg transition-colors ${
                  currentThreadId === thread.id ? 'bg-zinc-700/50' : 'hover:bg-zinc-800/30'
                }`}
              >
                <div className="text-sm font-medium truncate min-w-0 pr-2 flex items-center gap-1.5">
                  {threadStatusMap[thread.id]?.type === 'active' && (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {thread.name ?? thread.preview}
                </div>
                <div className="flex items-center justify-end h-6 w-12 relative">
                  <span className="text-xs text-muted-foreground whitespace-nowrap group-hover:hidden">
                    {formatThreadAge(thread.createdAt)}
                  </span>
                  <button
                    type="button"
                    aria-label="Archive thread"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleArchive(thread.id);
                    }}
                    className="absolute right-0 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent/50 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 max-md:opacity-100"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">
              <ContextMenuItem onSelect={() => openRenameDialog(thread)}>Rename</ContextMenuItem>
              <ContextMenuItem onSelect={() => void handleFork(thread.id)}>
                <GitFork className="mr-2 h-4 w-4" />
                Fork
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void handleArchive(thread.id)}>
                Archive
              </ContextMenuItem>
              {thread.cwd.includes('/.codexia/worktrees/') && (
                <ContextMenuItem onSelect={() => void handleDeleteWorktree(thread)}>
                  <FolderX className="mr-2 h-4 w-4" />
                  Delete Worktree
                </ContextMenuItem>
              )}
              <ContextMenuItem variant="destructive" onSelect={() => void handleDelete(thread.id)}>
                Delete
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(thread.id)}>
                Copy Id
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
        {threads.length === 0 && (
          <div className="text-center text-sm text-sidebar-foreground/50 py-8 px-4">
            {searchTerm ? 'No matching tasks.' : 'No tasks yet.'}
          </div>
        )}
      </div>
      {nextCursor && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="justify-start"
        >
          {isLoadingMore ? 'Loading more…' : 'Load more'}
        </Button>
      )}
      <RenameThreadDialog
        open={!!renameThreadId}
        onOpenChange={(open) => !open && setRenameThreadId(null)}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        handleRenameSubmit={handleRenameSubmit}
      />
    </div>
  );
}
