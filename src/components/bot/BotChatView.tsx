import { CalendarClock, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAcpEvents } from '@/components/acp/useAcpEvents';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useTrafficLightConfig } from '@/hooks';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { BotAvatar } from './BotAvatar';
import { BotComposer } from './BotComposer';
import { BotMessageList } from './BotMessageList';
import { BotPermissionGate } from './BotPermissionGate';
import { BotRoutines } from './BotRoutines';
import { BotSettingsDialog } from './BotSettingsDialog';
import { BotWelcome } from './BotWelcome';
import { TRUST_LEVELS } from './botAgentDef';
import { markBotRead } from './markBotRead';
import { useBotDragDrop } from './useBotDragDrop';
import { useBotSession } from './useBotSession';
import { useCreateBot } from './useCreateBot';

/** The full-screen conversation with one bot. */
export default function BotChatView() {
  const { bots, selectedBotId, connectionByBot } = useBotUiStore();
  const connectionId = useAcpStore((s) => s.connectionId);
  const { newBot, setNewBot, creating, handleCreateBot } = useCreateBot();
  const { open } = useBotSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const { open: isSidebarOpen, openMobile, isMobile } = useSidebar();
  const showTrigger = isMobile ? !openMobile : !isSidebarOpen;
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);

  useAcpEvents(connectionId);

  const bot = bots.find((b) => b.id === selectedBotId);
  useBotDragDrop(bot);

  if (!bot) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header
          className="flex h-11 shrink-0 items-center border-b border-white/10"
          data-tauri-drag-region
        >
          {showTrigger && (
            <div className={`flex items-center ${needsTrafficLightOffset ? 'pl-20' : 'pl-2'}`}>
              <SidebarTrigger />
            </div>
          )}
        </header>
        <BotWelcome
          bots={bots}
          creating={creating}
          onCreate={handleCreateBot}
          onSelect={(item) => {
            const status = useBotUiStore.getState().statusByBot[item.id];
            if (status === 'blocked' || status === 'failed') {
              useBotUiStore.getState().setBotStatus(item.id, null);
            }
            void markBotRead(item);
            void open(item);
          }}
        />
      </div>
    );
  }

  const trust = TRUST_LEVELS.find((level) => level.id === bot.trustLevel);
  const running = Boolean(connectionByBot[bot.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="flex shrink-0 items-center gap-2 border-b py-2 pr-4"
        data-tauri-drag-region
        title="Drop a folder here to set this bot's workspace"
      >
        <div
          className={`flex shrink-0 items-center gap-2 ${
            showTrigger ? (needsTrafficLightOffset ? 'pl-20' : 'pl-2') : 'pl-4'
          }`}
        >
          {showTrigger && <SidebarTrigger />}
        </div>
        <BotAvatar bot={bot} running={running} />
        <div className="min-w-0 flex-1" data-tauri-drag-region>
          <div className="truncate text-sm font-medium" data-tauri-drag-region>
            {bot.name}
          </div>
          <div className="truncate text-xs text-muted-foreground" data-tauri-drag-region>
            {[bot.title, bot.model, trust?.label].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Scheduled tasks"
          title="Scheduled tasks"
          onClick={() => setTasksOpen(true)}
        >
          <CalendarClock className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Bot settings"
          title="Bot settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </header>

      <BotMessageList bot={bot} />
      <BotPermissionGate bot={bot} />
      <BotComposer bot={bot} />

      <BotSettingsDialog
        bot={newBot ?? bot}
        open={settingsOpen || Boolean(newBot)}
        onOpenChange={(next) => {
          setSettingsOpen(next);
          if (!next) setNewBot(null);
        }}
      />
      <Dialog open={tasksOpen} onOpenChange={setTasksOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scheduled tasks · {bot.name}</DialogTitle>
          </DialogHeader>
          <BotRoutines key={bot.id} botId={bot.id} open={tasksOpen} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
