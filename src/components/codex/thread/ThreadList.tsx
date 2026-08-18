import { listen } from '@tauri-apps/api/event';
import type { LucideIcon } from 'lucide-react';
import { Archive, FolderX, GitFork, Loader2 } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type {
  Thread,
  ThreadListParams,
  ThreadListResponse,
  ThreadNameUpdatedNotification,
} from '@/bindings/v2';
import { useCodexStore, useConfigStore, useThreadListStore } from '@/components/codex/stores';
import { RenameThreadDialog } from '@/components/codex/thread/RenameThreadDialog';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from '@/components/ui/use-toast';
import { isDesktopTauri } from '@/hooks/runtime';
import { archiveThread, deleteThread, listThreads, renameThread } from '@/services/apiAdapt';
import { gitRemoveWorktree } from '@/services/apiAdapt/git';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { formatThreadAge } from '@/utils/formatThreadAge';

interface ThreadListProps {
  cwd: string;
}

interface ThreadAction {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

const EMPTY_LIST: ThreadListResponse = { data: [], nextCursor: null, backwardsCursor: null };

const PAGE_SIZE = 3;

export function ThreadList({ cwd }: ThreadListProps) {
  const { cwd: workspaceCwd, setCwd } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { currentThreadId, threadStatusMap, threads: storeThreads } = useCodexStore();
  const { sortKey } = useThreadListStore();
  const modelProvider = useConfigStore((s) => s.modelProvider);
  const [response, setResponse] = useState<ThreadListResponse>(EMPTY_LIST);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [pressedThreadId, setPressedThreadId] = useState<string | null>(null);

  const nextCursor = response.nextCursor;

  // A freshly started thread is not in the state DB yet, so the backend list
  // does not return it. Merge in live threads from the store so it shows up
  // immediately; the DB row takes over on the next reload.
  const threads = useMemo(() => {
    const seen = new Set(response.data.map((t) => t.id));
    const live = storeThreads.filter(
      (t) => t.cwd === cwd && t.modelProvider === modelProvider && !seen.has(t.id)
    );
    if (live.length === 0) return response.data;
    const key = sortKey === 'created_at' ? 'createdAt' : 'updatedAt';
    return [...live, ...response.data].sort((a, b) => b[key] - a[key]);
  }, [response.data, storeThreads, cwd, modelProvider, sortKey]);

  // --- Thread loading (search + sort delegated to backend) ---

  // Only show threads of the provider currently selected in the composer.
  const providerFilter = useMemo(() => [modelProvider], [modelProvider]);

  // Keep however many threads are already visible when the list reloads
  // (select / delete / archive / fork) instead of collapsing back to one page.
  const loadedRef = useRef({ cwd, count: 0 });
  if (loadedRef.current.cwd !== cwd) loadedRef.current = { cwd, count: 0 };

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCounter is the manual reload trigger
  useEffect(() => {
    let cancelled = false;
    const params: ThreadListParams = {
      limit: Math.max(PAGE_SIZE, loadedRef.current.count),
      sortKey,
      modelProviders: providerFilter,
      cwd,
      useStateDbOnly: true,
    };
    const load = async () => {
      try {
        const res = await listThreads(params);
        if (cancelled) return;
        loadedRef.current = { cwd, count: res.data.length };
        setResponse(res);
      } catch (err) {
        if (!cancelled) console.error('Failed to load threads:', err);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [cwd, sortKey, providerFilter, refreshCounter]);

  const refresh = useCallback(() => setRefreshCounter((n) => n + 1), []);

  // When a new thread is created in the store (e.g. after threadStart),
  // refresh the list so the sidebar reflects it immediately.
  const seenStoreIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const localIds = new Set(response.data.map((t) => t.id));
    const newIds = storeThreads
      .filter((t) => t.cwd === cwd && !localIds.has(t.id) && !seenStoreIdsRef.current.has(t.id))
      .map((t) => t.id);
    if (newIds.length === 0) return;
    for (const id of newIds) seenStoreIdsRef.current.add(id);
    refresh();
  }, [storeThreads, response.data, cwd, refresh]);

  useEffect(() => {
    if (!isDesktopTauri()) return;

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
    async (threadId: string) => {
      if (threadId === currentThreadId) return;
      if (cwd !== workspaceCwd) setCwd(cwd);
      await codexService.setCurrentThread(threadId);
    },
    [currentThreadId, cwd, workspaceCwd, setCwd]
  );

  const handleOpenThread = useCallback(
    async (threadId: string, preview?: string) => {
      addAgentCard({ kind: 'codex', id: threadId, preview, cwd });
      setCurrentAgentCardId(threadId);
      setView('agent');
      await handleSelectThread(threadId);
    },
    [handleSelectThread, setView, setCurrentAgentCardId, addAgentCard, cwd]
  );

  const handleArchive = useCallback(
    async (threadId: string) => {
      try {
        await archiveThread(threadId);
      } catch (err) {
        toast.error('Failed to archive thread', { description: String(err) });
        return;
      }
      refresh();
    },
    [refresh]
  );

  const handleFork = useCallback(
    async (threadId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      try {
        await codexService.threadFork(threadId);
      } catch (err) {
        toast.error('Failed to fork thread', { description: String(err) });
        return;
      }
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
      try {
        await deleteThread(threadId);
      } catch (err) {
        toast.error('Failed to delete thread', { description: String(err) });
        return;
      }
      if (currentThreadId === threadId) {
        await codexService.setCurrentThread(null);
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
        modelProviders: providerFilter,
        useStateDbOnly: true,
        sortKey,
        cwd,
      };
      const res = await listThreads(params);
      setResponse((prev) => {
        const seen = new Set(prev.data.map((t) => t.id));
        const data = [...prev.data, ...res.data.filter((t) => !seen.has(t.id))];
        loadedRef.current = { cwd, count: data.length };
        return { ...res, data };
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [cwd, isLoadingMore, nextCursor, sortKey, providerFilter]);

  const openRenameDialog = useCallback((thread: Thread) => {
    // Prefer explicit name, fall back to preview (first message).
    setRenameThreadId(thread.id);
    setRenameValue(thread.name ?? thread.preview);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameThreadId || !renameValue.trim()) return;
    try {
      await renameThread(renameThreadId, renameValue.trim());
    } catch (err) {
      toast.error('Failed to rename thread', { description: String(err) });
      return;
    }
    setRenameThreadId(null);
    // thread/name/updated notification patches response.data directly.
  }, [renameThreadId, renameValue]);

  // --- Touch long press opens the context menu (touch devices get no
  // native contextmenu event, so synthesize one at the touch point) ---

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressedThreadId(null);
  }, []);

  const startLongPress = useCallback(
    (e: ReactPointerEvent, threadId: string) => {
      if (e.pointerType === 'mouse') return;
      const target = e.currentTarget;
      const { clientX, clientY } = e;
      cancelLongPress();
      longPressFiredRef.current = false;
      setPressedThreadId(threadId);
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        setPressedThreadId(null);
        // The press may have started a native text selection that runs past
        // the row; drop it before opening the menu.
        window.getSelection()?.removeAllRanges();
        target.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY })
        );
      }, 450);
    },
    [cancelLongPress]
  );

  useEffect(() => cancelLongPress, [cancelLongPress]);

  // Shared action list for the context menu.
  const threadActions = useCallback(
    (thread: Thread): ThreadAction[] => [
      { label: 'Rename', onSelect: () => openRenameDialog(thread) },
      { label: 'Fork', icon: GitFork, onSelect: () => void handleFork(thread.id) },
      { label: 'Archive', icon: Archive, onSelect: () => void handleArchive(thread.id) },
      ...(thread.cwd.includes('/.codexia/worktrees/')
        ? [
            {
              label: 'Delete Worktree',
              icon: FolderX,
              onSelect: () => void handleDeleteWorktree(thread),
            },
          ]
        : []),
      { label: 'Delete', destructive: true, onSelect: () => void handleDelete(thread.id) },
      {
        label: 'Copy Id',
        separatorBefore: true,
        onSelect: () => void navigator.clipboard.writeText(thread.id),
      },
    ],
    [openRenameDialog, handleFork, handleArchive, handleDeleteWorktree, handleDelete]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
      <div className="min-h-0 flex-1">
        {threads.map((thread) => (
          <ContextMenu key={thread.id}>
            <ContextMenuTrigger asChild>
              <div
                onClick={() => {
                  if (longPressFiredRef.current) {
                    longPressFiredRef.current = false;
                    return;
                  }
                  void handleOpenThread(thread.id, thread.preview);
                }}
                onPointerDown={(e) => startLongPress(e, thread.id)}
                onPointerUp={cancelLongPress}
                onPointerMove={cancelLongPress}
                onPointerCancel={cancelLongPress}
                role="button"
                tabIndex={0}
                className={`group grid grid-cols-[1fr_auto] items-center gap-2 w-full text-left p-2 rounded-lg transition-all duration-200 touch-pan-y select-none [-webkit-user-select:none] [-webkit-touch-callout:none] ${
                  currentThreadId === thread.id ? 'bg-zinc-700/50' : 'hover:bg-zinc-800/30'
                } ${
                  pressedThreadId === thread.id
                    ? 'scale-[0.97] bg-accent/60 ring-1 ring-ring/60'
                    : 'scale-100'
                }`}
              >
                <div className="text-sm font-medium truncate min-w-0 pr-2 flex items-center gap-1.5">
                  {threadStatusMap[thread.id]?.type === 'active' && (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {thread.name ?? (thread.preview || 'New chat')}
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
                    className="absolute right-0 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent/50 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">
              {threadActions(thread).map((action) => (
                <Fragment key={action.label}>
                  {action.separatorBefore && <ContextMenuSeparator />}
                  <ContextMenuItem
                    variant={action.destructive ? 'destructive' : 'default'}
                    onSelect={action.onSelect}
                  >
                    {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </ContextMenuItem>
                </Fragment>
              ))}
            </ContextMenuContent>
          </ContextMenu>
        ))}
        {threads.length === 0 && (
          <div className="text-xs p-2 text-sidebar-foreground/50">No chats.</div>
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
