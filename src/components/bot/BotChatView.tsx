import { CalendarClock, History, Settings2, SquarePen } from 'lucide-react';
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
import { BotSessionList } from './BotSessionList';
import { BotSettingsDialog } from './BotSettingsDialog';
import { TRUST_LEVELS } from './botAgentDef';
import { useBotDragDrop } from './useBotDragDrop';
import { useBotSession } from './useBotSession';

/** The full-screen conversation with one bot. */
export default function BotChatView() {
  const { bots, selectedBotId, connectionByBot } = useBotUiStore();
  const connectionId = useAcpStore((s) => s.connectionId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panel, setPanel] = useState<'history' | 'tasks' | null>(null);
  const [starting, setStarting] = useState(false);
  const { startNew } = useBotSession();
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
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Pick a bot, or make a new one.
        </div>
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
          aria-label="Conversation history"
          title="Conversation history"
          onClick={() => setPanel('history')}
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="New session"
          title="New session"
          disabled={starting}
          onClick={async () => {
            setStarting(true);
            try {
              await startNew(bot);
            } finally {
              setStarting(false);
            }
          }}
        >
          <SquarePen className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Scheduled tasks"
          title="Scheduled tasks"
          onClick={() => setPanel('tasks')}
        >
          <CalendarClock className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Bot settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </header>

      <BotMessageList bot={bot} />
      <BotPermissionGate bot={bot} />
      <BotComposer bot={bot} />

      <BotSettingsDialog bot={bot} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {panel === 'history' ? 'Conversation history' : 'Scheduled tasks'} · {bot.name}
            </DialogTitle>
          </DialogHeader>
          {panel === 'history' && <BotSessionList key={bot.id} bot={bot} />}
          {panel === 'tasks' && <BotRoutines key={bot.id} botId={bot.id} open />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
