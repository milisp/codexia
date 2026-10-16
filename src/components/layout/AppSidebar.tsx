import { Bot, Bug, Monitor, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentLogo } from '@/components/agent/AgentLogo';
import { SideBarBotPane } from '@/components/bot';
import { BotNotifications } from '@/components/bot/BotNotifications';
import { BotSettingsDialog } from '@/components/bot/BotSettingsDialog';
import { BotTemplatePicker } from '@/components/bot/BotTemplatePicker';
import { useCreateBot } from '@/components/bot/useCreateBot';
import { DesktopDrawer } from '@/components/pairing/DesktopDrawer';
import { Button } from '@/components/ui/button';
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
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { UpdateIndicator } from '../../features/UpdateIndicator';
import { SessionManagerDialog } from '../common/SessionManagerDialog';
import { SideBarAgentHeader, SideBarAgentList, SideBarProjectActions } from './SideBarAgentPane';
import { SideBarPinnedList } from './SideBarPinnedList';
import { SideBarRecentChats } from './SideBarRecentChats';
import { SideBarSection } from './SideBarSection';
import { UserInfo } from './UserInfo';

export function AppSideBar() {
  const { t } = useTranslation('sidebar');
  const { activeSidebarTab, sidebarMode, setHasSeenBotTab } = useLayoutStore();
  const { open: isSidebarOpen } = useSidebar();
  const { isMacos } = useTrafficLightConfig(isSidebarOpen);
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [botsOpen, setBotsOpen] = useState(sidebarMode === 'bot');
  const [projectsOpen, setProjectsOpen] = useState(sidebarMode === 'agent');
  // Only a phone drives a remote machine; a desktop is its own backend and has
  // nothing to switch between.
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(false);
  const { newBot, setNewBot, creating, handleCreateBot, pickerOpen, setPickerOpen, createFrom } =
    useCreateBot();
  const setView = useLayoutStore((s) => s.setView);
  const selectedAgent = useAgentSettingsStore((s) => s.selectedAgent);
  const acpActive = useAcpStore((s) => s.active);
  const acpAgentId = useAcpStore((s) => s.agentId);
  // The project list below belongs to whichever agent drives the chat pane.
  const projectsAgentId = acpActive ? acpAgentId : selectedAgent;

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
          <SideBarAgentHeader />

          <SideBarSection
            icon={<Bot />}
            title="Bots"
            open={botsOpen}
            onOpenChange={(open) => {
              setBotsOpen(open);
              if (open) setHasSeenBotTab(true);
            }}
            onTitleClick={() => {
              setBotsOpen(true);
              setHasSeenBotTab(true);
              setView('bot');
            }}
            actions={
              <>
                <BotNotifications />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={t('newBot')}
                  aria-label={t('newBot')}
                  onClick={handleCreateBot}
                  disabled={creating}
                >
                  <Plus />
                </Button>
              </>
            }
          >
            <SideBarBotPane />
          </SideBarSection>

          <SideBarPinnedList />

          <SideBarSection
            icon={<AgentLogo id={projectsAgentId} className="size-3.5" />}
            title="Projects"
            open={projectsOpen}
            onOpenChange={setProjectsOpen}
            actions={<SideBarProjectActions />}
          >
            <SideBarAgentList />
          </SideBarSection>

          <SideBarRecentChats />
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

      <BotTemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        creating={creating}
        onPick={createFrom}
      />
      {newBot && (
        <BotSettingsDialog
          bot={newBot}
          open={Boolean(newBot)}
          onOpenChange={(open) => {
            if (!open) setNewBot(null);
          }}
        />
      )}

      {isPhone() && <DesktopDrawer open={desktopDrawerOpen} onOpenChange={setDesktopDrawerOpen} />}
    </>
  );
}
