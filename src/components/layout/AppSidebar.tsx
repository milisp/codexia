import { BarChart2, Bug, ListFilter, Monitor, Package2, Search, Timer } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentSwitcher } from '@/components/agent';
import { useNewThread, useThreadList } from '@/components/codex/hooks';
import { DesktopDrawer } from '@/components/pairing/DesktopDrawer';
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useTrafficLightConfig } from '@/hooks';
import { isPhone } from '@/hooks/runtime';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { UpdateIndicator } from '../../features/UpdateIndicator';
import { NewAgentButton } from '../common/NewAgentButton';
import { SessionManagerDialog } from '../common/SessionManagerDialog';
import { SideBarAddProjectButton } from './SideBarAddProjectButton';
import { SideBarPinnedList } from './SideBarPinnedList';
import { SideBarAcpTab, SideBarClaudeTab, SideBarCodexTab } from './SideBarTab';
import { UserInfo } from './UserInfo';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

// Shared class for nav buttons (Automations / Marketplace)
const navBtnBase = 'justify-start gap-2 rounded-md border px-2.5';
const navBtnActive = 'border-border bg-accent/70 text-accent-foreground';
const navBtnInactive = 'border-transparent hover:border-border/60';
const navBtnCls = (active: boolean) => `${navBtnBase} ${active ? navBtnActive : navBtnInactive}`;

export function AppSideBar() {
  const { t } = useTranslation('sidebar');
  const { cwd, setCwd } = useWorkspaceStore();
  const { setSelectedAgent, selectedAgent } = useAgentSettingsStore();
  const acpActive = useAcpStore((s) => s.active);
  const { setView, view, activeSidebarTab, setActiveSidebarTab } = useLayoutStore();
  const { open: isSidebarOpen } = useSidebar();
  const { isMacos } = useTrafficLightConfig(isSidebarOpen);
  const { sortKey, setSortKey } = useThreadList({
    enabled: isSidebarOpen && selectedAgent === 'codex',
  });
  const { handleNewThread } = useNewThread();
  const { handleNewSession } = useCCSessionManager();
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  // Only a phone drives a remote machine; a desktop is its own backend and has
  // nothing to switch between.
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(false);

  const currentThreadSortLabel = sortKey === 'created_at' ? 'Created' : 'Updated';

  const handleCreateNewThreadForProject = useCallback(
    (project: string) => {
      if (project !== cwd) setCwd(project);
      void handleNewThread();
    },
    [cwd, handleNewThread, setCwd]
  );

  const handleStartNewAcpSessionForProject = useCallback(
    (directory: string) => {
      setView('agent');
      setCwd(directory);
      // `restart` tears down the connection and asks the composer to reconnect
      // in the new workspace.
      useAcpStore.getState().restart();
    },
    [setCwd, setView]
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
    [handleNewSession, setActiveSidebarTab, setCwd, setSelectedAgent, setView]
  );

  return (
    <>
      <Sidebar className="border-r border-sidebar-border bg-zinc-100/95 dark:bg-zinc-900/95">
        <SidebarHeader className="gap-1 p-1">
          {/* Header row: toggle */}
          <div
            className={`flex items-center gap-2 ${isMacos ? 'pl-20' : 'pl-2'}`}
            data-tauri-drag-region
          >
            <SidebarTrigger className="h-7 w-7" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Manage sessions & threads"
              onClick={() => setSessionManagerOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
            {isPhone() && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Desktops"
                onClick={() => setDesktopDrawerOpen(true)}
              >
                <Monitor className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Nav actions */}
          <div className="flex flex-col">
            <NewAgentButton showLabel />
            <Button
              variant="ghost"
              size="sm"
              className={navBtnCls(view === 'plugins')}
              onClick={() => setView('plugins')}
            >
              <Package2 className="h-4 w-4" />
              {t('plugins')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={navBtnCls(view === 'automations')}
              onClick={() => setView('automations')}
            >
              <Timer className="h-4 w-4" />
              {t('automations')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={navBtnCls(view === 'insights')}
              onClick={() => setView('insights')}
            >
              <BarChart2 className="h-4 w-4" />
              {t('insights')}
            </Button>

            <SideBarPinnedList />
          </div>

          {/* Tab switcher row */}
          <span className="flex justify-between">
            <AgentSwitcher className="flex gap-2" />

            <span className="flex gap-2">
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
                    <DropdownMenuRadioItem value="created_at">
                      Sort by Created
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="updated_at">
                      Sort by Updated
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <SideBarAddProjectButton />
            </span>
          </span>
        </SidebarHeader>

        {/* Thread list — selectedAgent is single source of truth */}
        <SidebarContent className="min-w-0 max-w-full overflow-x-hidden gap-0 px-0">
          {acpActive ? (
            <SideBarAcpTab onStartNewSession={handleStartNewAcpSessionForProject} />
          ) : selectedAgent === 'codex' ? (
            <SideBarCodexTab onCreateNewThread={handleCreateNewThreadForProject} />
          ) : (
            <SideBarClaudeTab onStartNewSession={handleStartNewCcSessionForProject} />
          )}
        </SidebarContent>

        <SidebarFooter className="flex-row items-center p-0 min-w-0 max-w-full overflow-x-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <UserInfo />
          </div>
          <div className="flex-shrink-0 pr-2 flex items-center gap-2">
            <UpdateIndicator
              fallback={
                <a
                  href="https://github.com/milisp/codexia/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Bug className="h-4 w-4" />
                </a>
              }
            />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SessionManagerDialog
        open={sessionManagerOpen}
        onOpenChange={setSessionManagerOpen}
        defaultTab={activeSidebarTab === 'cc' ? 'cc' : 'codex'}
      />

      {isPhone() && <DesktopDrawer open={desktopDrawerOpen} onOpenChange={setDesktopDrawerOpen} />}
    </>
  );
}
