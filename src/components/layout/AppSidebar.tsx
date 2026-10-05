import { Bug, ChevronDown, Monitor, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SideBarBotPane } from '@/components/bot';
import { BotNotifications } from '@/components/bot/BotNotifications';
import { DesktopDrawer } from '@/components/pairing/DesktopDrawer';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { type SidebarMode, useLayoutStore } from '@/stores';
import { UpdateIndicator } from '../../features/UpdateIndicator';
import { SessionManagerDialog } from '../common/SessionManagerDialog';
import { SideBarAgentHeader, SideBarAgentList } from './SideBarAgentPane';
import { UserInfo } from './UserInfo';

export function AppSideBar() {
  const { t } = useTranslation('sidebar');
  const { activeSidebarTab, sidebarMode, setSidebarMode, setHasSeenBotTab } = useLayoutStore();
  const { open: isSidebarOpen } = useSidebar();
  const { isMacos } = useTrafficLightConfig(isSidebarOpen);
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  // Only a phone drives a remote machine; a desktop is its own backend and has
  // nothing to switch between.
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(false);

  const selectMode = (mode: SidebarMode) => {
    setSidebarMode(mode);
    // Expanding navigation must not replace the conversation currently open.
    if (mode === 'bot') {
      setHasSeenBotTab(true);
    }
  };

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
        </SidebarHeader>

        <SidebarContent className="min-w-0 max-w-full overflow-x-hidden gap-0 px-0">
          {(['bot', 'agent'] as const).map((mode) => (
            <Collapsible
              key={mode}
              open={sidebarMode === mode && !groupsCollapsed}
              onOpenChange={(open) => {
                setGroupsCollapsed(!open);
                if (open) selectMode(mode);
              }}
            >
              <div className="flex items-center px-1">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${sidebarMode === mode && !groupsCollapsed ? '' : '-rotate-90'}`}
                    />
                    {mode === 'bot' ? 'Bots' : `Projects / ${t('agent')}`}
                  </Button>
                </CollapsibleTrigger>
                {mode === 'bot' && <BotNotifications />}
              </div>
              <CollapsibleContent>
                {mode === 'bot' ? (
                  <SideBarBotPane />
                ) : (
                  <>
                    <SideBarAgentHeader />
                    <SideBarAgentList />
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
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
