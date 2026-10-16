// Pinned threads/sessions across all projects, shown as a collapsible sidebar section.
import { Pin, PinOff } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { type PinnedItem, usePinStore } from '@/stores/usePinStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';
import { SideBarSection } from './SideBarSection';

export function SideBarPinnedList() {
  const pinned = usePinStore((s) => s.pinned);
  const unpin = usePinStore((s) => s.unpin);
  const { setCwd } = useWorkspaceStore();
  const { setView, setActiveSidebarTab } = useLayoutStore();
  const open = useLayoutStore((s) => s.isPinnedListOpen);
  const setOpen = useLayoutStore((s) => s.setPinnedListOpen);
  const { setSelectedAgent } = useAgentSettingsStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { handleSessionSelect } = useCCSessionManager();

  const handleOpen = useCallback(
    async (item: PinnedItem) => {
      setCwd(item.cwd);
      addAgentCard({ kind: item.kind, id: item.id, preview: item.title, cwd: item.cwd });
      setCurrentAgentCardId(item.id);
      setSelectedAgent(item.kind);
      setActiveSidebarTab(item.kind);
      setView('agent');
      if (item.kind === 'codex') {
        await codexService.setCurrentThread(item.id);
      } else {
        await handleSessionSelect(item.id, item.cwd);
      }
    },
    [
      addAgentCard,
      handleSessionSelect,
      setActiveSidebarTab,
      setCurrentAgentCardId,
      setCwd,
      setSelectedAgent,
      setView,
    ]
  );

  if (pinned.length === 0) return null;

  return (
    <SideBarSection icon={<Pin />} title="Pinned" open={open} onOpenChange={setOpen}>
      {pinned.map((item) => (
        <div
          key={item.id}
          role="button"
          tabIndex={0}
          onClick={() => void handleOpen(item)}
          title={`${item.title}\n${item.cwd}`}
          className="group flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left hover:bg-accent/50"
        >
          <span className="min-w-0 flex-1 truncate text-xs">{item.title || 'Untitled'}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground group-hover:hidden">
            {getFilename(item.cwd)}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Unpin"
            className="hidden shrink-0 group-hover:inline-flex"
            onClick={(e) => {
              e.stopPropagation();
              unpin(item.id);
            }}
          >
            <PinOff />
          </Button>
        </div>
      ))}
    </SideBarSection>
  );
}
