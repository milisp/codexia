import { Bug, ChevronDown, ChevronRight, Monitor, Plus, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SideBarBotPane } from '@/components/bot';
import { BotNotifications } from '@/components/bot/BotNotifications';
import { BotSettingsDialog } from '@/components/bot/BotSettingsDialog';
import { defaultLook, newBotId } from '@/components/bot/botDefaults';
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
import { toast } from '@/components/ui/use-toast';
import { useTrafficLightConfig } from '@/hooks';
import { isPhone } from '@/hooks/runtime';
import { type Bot, createBot } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { UpdateIndicator } from '../../features/UpdateIndicator';
import { SessionManagerDialog } from '../common/SessionManagerDialog';
import { SideBarAgentHeader, SideBarAgentList, SideBarProjectActions } from './SideBarAgentPane';
import { SideBarPinnedList } from './SideBarPinnedList';
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
  const [newBot, setNewBot] = useState<Bot | null>(null);
  const cwd = useWorkspaceStore((s) => s.cwd);
  const bots = useBotUiStore((s) => s.bots);
  const upsertBot = useBotUiStore((s) => s.upsertBot);
  const setView = useLayoutStore((s) => s.setView);

  const handleCreateBot = useCallback(async () => {
    const look = defaultLook(bots.length);
    try {
      const bot = await createBot({
        id: newBotId(),
        name: `Bot ${bots.length + 1}`,
        avatar: look.avatar,
        color: look.color,
        cwd: cwd ?? '',
      });
      upsertBot(bot);
      useAcpStore.getState().reset();
      useAcpStore.getState().setAgentId(bot.agentId);
      useBotUiStore.getState().setSelectedBotId(bot.id);
      setView('bot');
      setNewBot(bot);
    } catch (error) {
      toast({ title: 'Could not create bot', description: String(error), variant: 'destructive' });
    }
  }, [bots.length, cwd, setView, upsertBot]);

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

          <Collapsible
            open={botsOpen}
            onOpenChange={(open) => {
              setBotsOpen(open);
              if (open) setHasSeenBotTab(true);
            }}
          >
            <div className="flex items-center px-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2">
                  <span>Bots</span>
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground/60 transition-transform ${botsOpen ? 'rotate-90' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <BotNotifications />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title={t('newBot')}
                aria-label={t('newBot')}
                onClick={handleCreateBot}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <CollapsibleContent>
              <SideBarBotPane />
            </CollapsibleContent>
          </Collapsible>

          <SideBarPinnedList />

          <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
            <div className="flex items-center px-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2">
                  <span>Projects</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground/60 transition-transform ${projectsOpen ? '' : '-rotate-90'}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <SideBarProjectActions />
            </div>
            <CollapsibleContent>
              <SideBarAgentList />
            </CollapsibleContent>
          </Collapsible>
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
