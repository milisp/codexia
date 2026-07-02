import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeleteConfirmDialog, Toolbar } from '@/components/common/SessionManagerShared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { listSessions, type SdkSessionInfo } from '@/lib/sessions';
import { ccDeleteSession } from '@/services/tauri/cc';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { formatThreadAge } from '@/utils/formatThreadAge';
import { getFilename } from '@/utils/getFilename';

interface CCSessionManagerProps {
  open: boolean;
  onClose: () => void;
}

export function CCSessionManager({ open, onClose }: CCSessionManagerProps) {
  const [sessions, setSessions] = useState<SdkSessionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [offset, setOffset] = useState(0);
  const { toast } = useToast();
  const { cwd, setCwd, setSelectedAgent } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();

  const PAGE_SIZE = 20;

  const handleOpenSession = (session: SdkSessionInfo) => {
    if (session.cwd && session.cwd !== cwd) {
      setCwd(session.cwd);
    }
    setSelectedAgent('cc');
    addAgentCard({
      kind: 'cc',
      id: session.session_id,
      preview: session.summary,
      cwd: session.cwd || cwd,
    });
    setCurrentAgentCardId(session.session_id);
    setView('agent');
    onClose();
  };

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
        s.session_id.toLowerCase().includes(q)
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
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
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
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/40 group cursor-pointer"
              onClick={() => handleOpenSession(session)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenSession(session);
                }
              }}
            >
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <Checkbox
                  checked={selectedIds.has(session.session_id)}
                  onCheckedChange={() => toggle(session.session_id)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {session.summary || session.session_id}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {getFilename(session.cwd ?? '') || session.cwd || 'Unknown project'}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {formatThreadAge(Math.floor(session.last_modified / 1000))}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDeleteIds([session.session_id]);
                }}
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
          <span>
            {offset + 1}-{offset + filtered.length} / {total}
          </span>
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
