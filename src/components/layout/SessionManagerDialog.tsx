import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Search, CheckSquare, Square } from 'lucide-react';
import { listSessions, type SdkSessionInfo } from '@/lib/sessions';
import { ccDeleteSession } from '@/services/tauri/cc';
import { deleteFile } from '@/services/tauri';
import type { ThreadListItem } from '@/types/codex/ThreadListItem';
import { codexService } from '@/services/codexService';
import { useCodexStore, useThreadListStore } from '@/stores/codex';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentIcon } from '@/components/common/AgentIcon';
import { formatThreadAge } from '@/utils/formatThreadAge';
import { getFilename } from '@/utils/getFilename';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';

type AgentTab = 'cc' | 'codex';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: AgentTab;
}

export function SessionManagerDialog({ open, onOpenChange, defaultTab = 'cc' }: Props) {
  const [activeTab, setActiveTab] = useState<AgentTab>(defaultTab);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-2xl h-[70vh]">
        <DialogHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-0 shrink-0">
          <DialogTitle className="text-base">Session Manager</DialogTitle>
          {/* Agent tab switcher */}
          <div className="flex items-center gap-1 mr-6">
            {(['cc', 'codex'] as AgentTab[]).map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${activeTab === tab ? 'bg-accent' : ''}`}
                onClick={() => setActiveTab(tab)}
                title={tab === 'cc' ? 'Claude Code sessions' : 'Codex threads'}
              >
                <AgentIcon agent={tab} />
              </Button>
            ))}
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 px-4 pb-4 pt-3">
          {activeTab === 'cc' ? (
            <CCSessionManager open={open} />
          ) : (
            <CodexThreadManager />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CC Session Manager ────────────────────────────────────────────────────────

function CCSessionManager({ open }: { open: boolean }) {
  const [sessions, setSessions] = useState<SdkSessionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [offset, setOffset] = useState(0);
  const { toast } = useToast();
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSessions(undefined, {
        limit: PAGE_SIZE,
        offset,
        includeWorktrees: true,
      });
      setSessions(data.sessions);
      setTotal(data.total);
    } catch {
      toast({ description: 'Failed to load sessions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [offset, toast]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, open]);

  useEffect(() => {
    setOffset(0);
    setSelectedIds(new Set());
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.summary.toLowerCase().includes(q) ||
        (s.cwd ?? '').toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q),
    );
  }, [sessions, search]);

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.session_id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.session_id)));
    }
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const doDelete = async (ids: string[]) => {
    let failed = 0;
    for (const id of ids) {
      try {
        await ccDeleteSession(id);
      } catch {
        failed++;
      }
    }
    setSessions((prev) => prev.filter((s) => !ids.includes(s.session_id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    if (failed > 0) {
      toast({ description: `Failed to delete ${failed} session(s)`, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        selectedCount={selectedIds.size}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onDeleteSelected={() => setPendingDeleteIds(Array.from(selectedIds))}
      />

      <ScrollArea className="flex-1 min-h-0 mt-2">
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No sessions found</div>
        ) : (
          filtered.map((session) => (
            <div
              key={session.session_id}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/40 group"
            >
              <Checkbox
                checked={selectedIds.has(session.session_id)}
                onCheckedChange={() => toggle(session.session_id)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{session.summary || session.session_id}</div>
                <div className="text-xs text-muted-foreground truncate">{getFilename(session.cwd ?? '') || session.cwd || 'Unknown project'}</div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {formatThreadAge(Math.floor(session.last_modified / 1000))}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setPendingDeleteIds([session.session_id])}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </ScrollArea>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>All projects</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
          >
            Prev
          </Button>
          <span>{offset + 1}-{offset + filtered.length} / {total}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={loading || offset + PAGE_SIZE >= total}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!pendingDeleteIds}
        count={pendingDeleteIds?.length ?? 0}
        onCancel={() => setPendingDeleteIds(null)}
        onConfirm={() => {
          if (pendingDeleteIds) {
            void doDelete(pendingDeleteIds);
            setPendingDeleteIds(null);
          }
        }}
      />
    </>
  );
}

// ── Codex Thread Manager ──────────────────────────────────────────────────────

function CodexThreadManager() {
  const { threads, currentThreadId } = useCodexStore();
  const { sortKey } = useThreadListStore();
  const { cwd } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteItems, setPendingDeleteItems] = useState<ThreadListItem[] | null>(null);
  const { toast } = useToast();

  // Load full thread list on mount
  useEffect(() => {
    void codexService.loadThreads(cwd, false, sortKey);
  }, [cwd, sortKey]);

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

  const doDelete = async (items: ThreadListItem[]) => {
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
    // Refresh global thread list so sidebar updates
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

      <ScrollArea className="flex-1 min-h-0 mt-2">
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No threads found</div>
        ) : (
          filtered.map((thread) => (
            <div
              key={thread.id}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/40 group"
            >
              <Checkbox
                checked={selectedIds.has(thread.id)}
                onCheckedChange={() => toggle(thread.id)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{thread.preview || thread.id}</div>
                <div className="text-xs text-muted-foreground truncate">{getFilename(thread.cwd) || thread.cwd}</div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {formatThreadAge(thread.createdAt ?? 0)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setPendingDeleteItems([thread])}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
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

// ── Shared sub-components ─────────────────────────────────────────────────────

interface ToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
}

function Toolbar({ search, onSearch, selectedCount, allSelected, onToggleAll, onDeleteSelected }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onToggleAll}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title={allSelected ? 'Deselect all' : 'Select all'}
      >
        {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </button>
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-8 pl-7"
        />
      </div>
      {selectedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete {selectedCount}
        </Button>
      )}
    </div>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, count, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count === 1 ? '1 item' : `${count} items`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The selected {count === 1 ? 'item' : 'items'} and {count === 1 ? 'its' : 'their'} history will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
