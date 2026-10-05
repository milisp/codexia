import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { listBots } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { markBotRead } from './markBotRead';
import { useBotSession } from './useBotSession';

export function BotNotifications() {
  const { bots, statusByBot, runningByBot, setBotStatus } = useBotUiStore();
  const { open } = useBotSession();
  const [visible, setVisible] = useState(false);
  const { setView, setSidebarMode } = useLayoutStore();
  useEffect(() => {
    listBots()
      .then(useBotUiStore.getState().setBots)
      .catch((error) => console.error('Could not load bot notifications', error));
  }, []);
  const results = bots.filter(
    (bot) =>
      bot.unreadCount > 0 || statusByBot[bot.id] === 'blocked' || statusByBot[bot.id] === 'failed'
  );
  return (
    <Popover open={visible} onOpenChange={setVisible}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Bot notifications (${results.length})`}
          title="Bot notifications"
          className="h-8 w-8 shrink-0"
        >
          <Bell className="h-4 w-4" />
          {results.length > 0 && <span className="text-[10px]">{results.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-96 overflow-y-auto">
        <h3 className="mb-2 text-sm font-semibold">Bot notifications</h3>
        {results.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No unread results or bots needing attention.
          </p>
        )}
        {results.map((bot) => (
          <Button
            key={bot.id}
            variant="ghost"
            className="h-auto w-full flex-col items-start whitespace-normal text-left"
            onClick={() => {
              setVisible(false);
              setSidebarMode('bot');
              setView('bot');
              if (statusByBot[bot.id] === 'blocked' || statusByBot[bot.id] === 'failed')
                setBotStatus(bot.id, null);
              void markBotRead(bot);
              void open(bot);
            }}
          >
            <span className="font-medium">{bot.name}</span>
            <span className="text-xs text-muted-foreground">
              {runningByBot[bot.id] ? 'Working' : (statusByBot[bot.id] ?? 'Unread result')} ·{' '}
              {bot.unreadCount} unread
            </span>
            {bot.title && (
              <span className="line-clamp-2 text-xs text-muted-foreground">{bot.title}</span>
            )}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
