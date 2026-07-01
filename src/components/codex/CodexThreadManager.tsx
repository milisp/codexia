import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteFile, listThreads } from '@/services/tauri';
import { codexService } from '@/services/codexService';
import { useCodexStore, useThreadListStore } from '@/components/codex/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
import { formatThreadAge } from '@/utils/formatThreadAge';
import { getFilename } from '@/utils/getFilename';
import type { Thread, ThreadListParams } from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Toolbar, DeleteConfirmDialog } from '@/components/common/SessionManagerShared';
import { modelProviders } from './ThreadList';

interface CodexThreadManagerProps {
  onClose: () => void;
}

const PAGE_SIZE = 20;

export function CodexThreadManager({ onClose }: CodexThreadManagerProps) {
  // This manager keeps its own thread list (fetched directly via listThreads)
  // instead of reading from useCodexStore, since that store only tracks the
  // globally-loaded/active thread set. currentThreadId is still read from the
  // store since it's needed to know which thread to reset when deleting.
  const { currentThreadId } = useCodexStore();
  const { sortKey } = useThreadListStore();
  const { cwd, setCwd } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteItems, setPendingDeleteItems] = useState<Thread[] | null>(null);
  const { toast } = useToast();

  // Local pagination state, independent from the global store.
  const [threads, setThreads] = useState<Thread[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Separate flag for appending a page (infinite scroll) vs. replacing the
  // whole list, so the existing rows stay mounted while more load in.
  const [loadingMore, setLoadingMore] = useState(false);
  // Whether to filter by the current workspace cwd, or show threads from all cwds.
  const [scopeToCwd, setScopeToCwd] = useState(true);
  // Sentinel element at the bottom of the list; observed to auto-trigger
  // loading the next page instead of requiring a "Load more" click.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleOpenThread = async (thread: Thread) => {
    const targetCwd = thread.cwd || cwd;
    if (targetCwd && targetCwd !== cwd) {
      setCwd(targetCwd);
    }
    addAgentCard({ kind: 'codex', id: thread.id, preview: thread.preview, cwd: targetCwd });
    setCurrentAgentCardId(thread.id);
    setView('agent');
    onClose();
    await codexService.setCurrentThread(thread.id, { resume: true });
  };

  // Fetch a page of threads directly via listThreads, optionally
  // scoped to the current workspace cwd. Resets the list unless appending.
  const fetchThreads = useCallback(
    async (cursor: string | null, append: boolean) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const params: ThreadListParams = {
          cursor,
          limit: PAGE_SIZE,
          modelProviders: modelProviders,
          archived: false,
          sortKey,
          cwd: scopeToCwd ? cwd : null,
          useStateDbOnly: true
        };
        const response = await listThreads(params);
        setThreads((prev) => (append ? [...prev, ...response.data] : response.data));
        setNextCursor(response.nextCursor ?? null);
      } catch (error) {
        console.error('[CodexThreadManager] Failed to load threads:', error);
        if (!append) setThreads([]);
        setNextCursor(null);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [cwd, sortKey, scopeToCwd],
  );

  // Reload from the first page whenever cwd scope or sort changes.
  useEffect(() => {
    void fetchThreads(null, false);
  }, [fetchThreads]);

  // Infinite scroll: observe a sentinel at the bottom of the list and load
  // the next page automatically when it comes into view, so new rows appear
  // right where the user is already looking instead of requiring a manual
  // "Load more" click followed by more scrolling.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loading && !loadingMore) {
          void fetchThreads(nextCursor, true);
        }
      },
      { root: sentinel.closest('[data-radix-scroll-area-viewport]'), rootMargin: '80px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loading, loadingMore, fetchThreads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        (t.preview ?? '').toLowerCase().includes(q) ||
        (t.cwd ?? '').toLowerCase().includes(q),
    );
  }, [threads, search]);

  const allSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const doDelete = async (items: Thread[]) => {
    let failed = 0;
    for (const item of items) {
      if (!item.path) { failed++; continue; }
      try {
        await deleteFile(item.path);
        if (currentThreadId === item.id) {
          await codexService.setCurrentThread(null, { resume: false });
        }
      } catch {
        failed++;
      }
    }
    const deletedIds = new Set(items.map((t) => t.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    setThreads((prev) => prev.filter((t) => !deletedIds.has(t.id)));
    // Refresh global thread list so sidebar (which still reads useCodexStore) updates.
    await codexService.loadThreads(cwd, false, sortKey);
    if (failed > 0) {
      toast({ description: `Failed to delete ${failed} thread(s)`, variant: 'destructive' });
    }
  };

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        selectedCount={selectedIds.size}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onDeleteSelected={() => {
          const items = threads.filter((t) => selectedIds.has(t.id));
          setPendingDeleteItems(items);
        }}
      />

      <div className="flex items-center gap-2 px-1 py-1 text-xs">
        <Button
          variant={scopeToCwd ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setScopeToCwd(true)}
        >
          Current folder
        </Button>
        <Button
          variant={!scopeToCwd ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setScopeToCwd(false)}
        >
          All folders
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0 mt-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8 animate-in fade-in duration-150">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading threads…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center animate-in fade-in duration-200">No threads found</div>
        ) : (
          filtered.map((thread) => (
            <div
              key={thread.id}
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/40 group cursor-pointer animate-in fade-in slide-in-from-top-1 duration-200 transition-colors"
              onClick={() => void handleOpenThread(thread)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleOpenThread(thread);
                }
              }}
            >
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <Checkbox
                  checked={selectedIds.has(thread.id)}
                  onCheckedChange={() => toggle(thread.id)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{thread.preview || thread.id}</div>
                <div className="flex gap-2 text-xs text-muted-foreground truncate">
                  <span>{getFilename(thread.cwd) || thread.cwd}</span>
                  {formatThreadAge(thread.createdAt ?? 0)}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition-opacity duration-150"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteItems([thread]);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
        {/* Sentinel for infinite scroll — triggers loading the next page when
            it scrolls into view. Shows an inline spinner while fetching so
            new rows appear right where the user is looking. */}
        {!loading && nextCursor && (
          <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
            {loadingMore && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more…
              </>
            )}
          </div>
        )}
      </ScrollArea>

      <DeleteConfirmDialog
        open={!!pendingDeleteItems}
        count={pendingDeleteItems?.length ?? 0}
        onCancel={() => setPendingDeleteItems(null)}
        onConfirm={() => {
          if (pendingDeleteItems) {
            void doDelete(pendingDeleteItems);
            setPendingDeleteItems(null);
          }
        }}
      />
    </>
  );
}
