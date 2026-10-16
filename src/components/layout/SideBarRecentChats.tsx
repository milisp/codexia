import { History, SquarePen } from 'lucide-react';
import { useNewThread } from '@/components/codex/hooks';
import { ThreadList } from '@/components/codex/thread/ThreadList';
import { Button } from '@/components/ui/button';
import { useServerProjectsStore } from '@/features/projects/useServerProjectsStore';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { SideBarSection } from './SideBarSection';

const RECENT_ID = 'recent';

/** Codex chats outside any app-server project, shown as its own section next to Projects. */
export function SideBarRecentChats() {
  const selectedAgent = useAgentSettingsStore((s) => s.selectedAgent);
  const acpActive = useAcpStore((s) => s.active);
  const serverStatus = useServerProjectsStore((s) => s.status);
  const { expandedProjects, setProjectExpanded } = useLayoutStore();
  const { handleNewThread } = useNewThread();

  // Only app-server projects split chats into "in a project" and "not".
  if (acpActive || selectedAgent !== 'codex' || serverStatus !== 'ready') return null;

  const open = expandedProjects[RECENT_ID] ?? true;
  const startChat = () => {
    const { cwd, setCwd } = useWorkspaceStore.getState();
    if (cwd !== null) setCwd(null);
    void handleNewThread();
  };

  return (
    <SideBarSection
      icon={<History />}
      title="Recent"
      open={open}
      onOpenChange={(next) => setProjectExpanded(RECENT_ID, next)}
      actions={
        <Button
          variant="ghost"
          size="icon-sm"
          title="New chat"
          aria-label="New chat"
          onClick={startChat}
        >
          <SquarePen />
        </Button>
      }
    >
      <div className="px-2 pb-2">
        <ThreadList projectId={null} />
      </div>
    </SideBarSection>
  );
}
