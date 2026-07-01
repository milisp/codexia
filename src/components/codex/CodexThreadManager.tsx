import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteFile } from '@/services/tauri';
import { codexService } from '@/services/codexService';
import { useCodexStore, useThreadListStore } from '@/components/codex/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLayoutStore, useAgentCenterStore } from '@/stores';
import { formatThreadAge } from '@/utils/formatThreadAge';
import { getFilename } from '@/utils/getFilename';
import type { Thread } from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Toolbar, DeleteConfirmDialog } from '@/components/common/SessionManagerShared';

interface CodexThreadManagerProps {
  onClose: () => void;
}

export function CodexThreadManager({ onClose }: CodexThreadManagerProps) {
  const { threads, currentThreadId } = useCodexStore();
  const { sortKey } = useThreadListStore();
  const { cwd, setCwd } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteItems, setPendingDeleteItems] = useState<Thread[] | null>(null);
  const { toast } = useToast();

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

  // Load full thread list on mount
  useEffect(() => {
    void codexService.loadThreads(null, false, sortKey);
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
                <div className="flex gap-2 text-xs text-muted-foreground truncate">
                  <span>{getFilename(thread.cwd) || thread.cwd}</span>
                  {formatThreadAge(thread.createdAt ?? 0)}
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
              </div>
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
