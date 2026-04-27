import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Search, CheckSquare, Square } from 'lucide-react';
import { getSessions, SessionData } from '@/lib/sessions';
import { ccDeleteSession, ccGetSessionFilePath } from '@/services/tauri/cc';
import { deleteFile } from '@/services/tauri';
import { readTextFileLines } from '@/services/tauri/filesystem';
import { parseSessionJsonl } from '@/components/cc/utils/parseSessionJsonl';
import type { ThreadListItem } from '@/types/codex/ThreadListItem';
import { codexService } from '@/services/codexService';
import { isGitRepo } from '@/services/tauri/git';
import { useCodexStore, useThreadListStore } from '@/stores/codex';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useCCStore } from '@/stores/cc';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
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
            <CCSessionManager onClose={() => onOpenChange(false)} />
          ) : (
            <CodexThreadManager onClose={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CC Session Manager ────────────────────────────────────────────────────────

function CCSessionManager({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const { toast } = useToast();
  const { cwd, setCwd, setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { sessionMessagesMap, addMessageToSession, setSessionLoading } = useCCStore();

  const handleOpenSession = async (session: SessionData) => {
    if (session.project && session.project !== cwd) {
      if (await isGitRepo(session.project)) {
        setCwd(session.project);
      } else {
        toast({ description: `Session cwd '${session.project}' isn't a git repo — keeping current project.` });
      }
    }
    setSelectedAgent('cc');
    addAgentCard({ kind: 'cc', id: session.sessionId, preview: session.display, cwd: session.project || cwd });
    setCurrentAgentCardId(session.sessionId);
    setView('agent');
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
    onClose();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSessions();
      setSessions(data);
    } catch {
      toast({ description: 'Failed to load sessions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.display.toLowerCase().includes(q) ||
        s.project.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q),
    );
  }, [sessions, search]);

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.sessionId));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.sessionId)));
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
    setSessions((prev) => prev.filter((s) => !ids.includes(s.sessionId)));
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
              key={session.sessionId}
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/40 group cursor-pointer"
              onClick={() => void handleOpenSession(session)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleOpenSession(session);
                }
              }}
            >
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <Checkbox
                  checked={selectedIds.has(session.sessionId)}
                  onCheckedChange={() => toggle(session.sessionId)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{session.display}</div>
                <div className="text-xs text-muted-foreground truncate">{getFilename(session.project) || session.project}</div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {formatThreadAge(session.timestamp)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDeleteIds([session.sessionId]);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </ScrollArea>

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

function CodexThreadManager({ onClose }: { onClose: () => void }) {
  const { threads, currentThreadId } = useCodexStore();
  const { sortKey } = useThreadListStore();
  const { cwd, setCwd } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteItems, setPendingDeleteItems] = useState<ThreadListItem[] | null>(null);
  const { toast } = useToast();

  const handleOpenThread = async (thread: ThreadListItem) => {
    const targetCwd = thread.cwd || cwd;
    if (targetCwd && targetCwd !== cwd) {
      if (await isGitRepo(targetCwd)) {
        setCwd(targetCwd);
      } else {
        toast({ description: `Thread cwd '${targetCwd}' isn't a git repo — keeping current project.` });
      }
    }
    addAgentCard({ kind: 'codex', id: thread.id, preview: thread.preview, cwd: targetCwd });
    setCurrentAgentCardId(thread.id);
    setView('agent');
    onClose();
    await codexService.setCurrentThread(thread.id, { resume: true });
  };

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
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/40 group cursor-pointer"
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
                <div className="text-xs text-muted-foreground truncate">{getFilename(thread.cwd) || thread.cwd}</div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {formatThreadAge(thread.createdAt ?? 0)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDeleteItems([thread]);
                }}
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
