import { BarChart2, ListFilter, Lock, Package2, Timer, Trash2 } from 'lucide-react';
import { useAgentLimit } from '@/hooks/useAgentLimit';
import { useCallback, useState } from 'react';
import { useLayoutStore } from '@/stores';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { UserInfo } from './UserInfo';
import { useThreadList } from '@/hooks/codex';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/settings';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { UpdateButton } from '../features/UpdateButton';
import { useTrafficLightConfig } from '@/hooks';
import { SideBarCodexTab } from './SideBarCodexTab';
import { SideBarClaudeTab } from './SideBarClaudeTab';
import { AgentSwitcher } from '@/components/agent';
import { SessionManagerDialog } from './SessionManagerDialog';
import { FeedbackDialog } from '../dialogs/FeedbackDialog';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

// Shared class for nav buttons (Automations / Marketplace)
const navBtnBase = 'justify-start gap-2 rounded-md border px-2.5';
const navBtnActive = 'border-border bg-accent/70 text-foreground';
const navBtnInactive = 'border-transparent hover:border-border/60';
const navBtnCls = (active: boolean) => `${navBtnBase} ${active ? navBtnActive : navBtnInactive}`;

export function SideBar() {
  const { cwd, setCwd, setSelectedAgent } = useWorkspaceStore();
  const { isPro } = useAgentLimit();
  const { setView, view, activeSidebarTab, setActiveSidebarTab } = useLayoutStore();
  const { open: isSidebarOpen } = useSidebar();
  const { isMacos } = useTrafficLightConfig(isSidebarOpen);
  const { searchTerm, setSearchTerm, sortKey, setSortKey, handleNewThread } = useThreadList({
    enabled: isSidebarOpen && activeSidebarTab === 'codex',
  });
  const { handleNewSession } = useCCSessionManager();
  const { showSidebarMarketplace } = useSettingsStore();
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);

  const currentThreadSortLabel = sortKey === 'created_at' ? 'Created' : 'Updated';

  const handleCreateNewThreadForProject = useCallback(
    (project: string) => {
      if (project !== cwd) setCwd(project);
      void handleNewThread();
    },
    [cwd, handleNewThread, setCwd],
  );

  const handleStartNewCcSessionForProject = useCallback(
    async (directory: string) => {
      setSelectedAgent('cc');
      setActiveSidebarTab('cc');
      setView('agent');
      setCwd(directory);
      await handleNewSession();
      focusCCInput();
    },
    [handleNewSession, setActiveSidebarTab, setCwd, setSelectedAgent, setView],
  );

  return (
    <>
      <Sidebar className="border-r border-sidebar-border bg-zinc-100/95 dark:bg-zinc-900/95">
        <SidebarHeader className="gap-1 p-2">

          {/* Header row: toggle */}
          <div
            className={`flex items-center gap-2 ${isMacos ? 'pl-20' : 'pl-2'}`}
            data-tauri-drag-region
          >
            <SidebarTrigger className="h-7 w-7" />
          </div>

          {/* Search */}
          <SidebarInput
            placeholder="Search threads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Nav actions */}
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="sm"
              className={navBtnCls(view === 'automations')}
              onClick={() => setView('automations')}
            >
              <Timer className="h-4 w-4" />
              Automations
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={navBtnCls(view === 'insights')}
              onClick={() => setView('insights')}
            >
              <BarChart2 className="h-4 w-4" />
              Insights
              {!isPro && !import.meta.env.DEV && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
            </Button>

            {showSidebarMarketplace && (
              <Button
                variant="ghost"
                size="sm"
                className={navBtnCls(view === 'plugins')}
                onClick={() => setView('plugins')}
              >
                <Package2 className="h-4 w-4" />
                Plugins
              </Button>
            )}
          </div>

          {/* Tab switcher row */}
          <span className="flex justify-between">
            <AgentSwitcher className="flex gap-2" />

            <span className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Manage sessions & threads"
                onClick={() => setSessionManagerOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={`Filter threads (current: ${currentThreadSortLabel})`}
                  >
                    <ListFilter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={sortKey}
                    onValueChange={(v) => setSortKey(v as 'created_at' | 'updated_at')}
                  >
                    <DropdownMenuRadioItem value="created_at">Sort by Created</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="updated_at">Sort by Updated</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </span>
        </SidebarHeader>

        {/* Thread list */}
        <SidebarContent className="min-w-0 max-w-full overflow-x-hidden gap-0 px-0">
          {activeSidebarTab === 'codex' && (
            <SideBarCodexTab onCreateNewThread={handleCreateNewThreadForProject} />
          )}
          {activeSidebarTab === 'cc' && (
            <SideBarClaudeTab onStartNewSession={handleStartNewCcSessionForProject} />
          )}
        </SidebarContent>

        <SidebarFooter className="flex-row items-center p-0 min-w-0 max-w-full overflow-x-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <UserInfo />
          </div>
          <div className="flex-shrink-0 pr-2 flex items-center gap-2">
            <UpdateButton />
            <FeedbackDialog />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SessionManagerDialog
        open={sessionManagerOpen}
        onOpenChange={setSessionManagerOpen}
        defaultTab={activeSidebarTab === 'cc' ? 'cc' : 'codex'}
      />
    </>
  );
}
