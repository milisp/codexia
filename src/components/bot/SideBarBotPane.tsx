import { Sun } from 'lucide-react';
import { useEffect } from 'react';
import { listBots } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { BotAvatar } from './BotAvatar';
import { useBotInbox } from './useBotInbox';
import { useOpenBot } from './useOpenBot';

/** "3m", "4h", "2d" — enough to place a conversation without a full date. */
function since(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * The bot list: one flat, most-recent-first column, the way a messages app
 * shows conversations. Reading it never starts an agent — a bot's process only
 * wakes when you open it.
 */
export function SideBarBotPane() {
  const { bots, setBots, selectedBotId, connectionByBot, runningByBot, statusByBot } =
    useBotUiStore();
  const setView = useLayoutStore((s) => s.setView);
  const select = useOpenBot();

  useEffect(() => {
    listBots()
      .then(setBots)
      .catch((e) => console.error('bots: failed to list', e));
  }, [setBots]);

  const view = useLayoutStore((s) => s.view);
  const { items: inbox } = useBotInbox();
  const needsYou = bots.filter((bot) => statusByBot[bot.id] === 'waiting').length + inbox.length;
  const onToday = view === 'bot' && !selectedBotId;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {bots.length > 0 && (
          <button
            type="button"
            onClick={() => {
              useBotUiStore.getState().setSelectedBotId(null);
              setView('bot');
            }}
            aria-current={onToday ? 'page' : undefined}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50 ${
              onToday ? 'bg-accent font-medium' : ''
            }`}
          >
            <Sun className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Today</span>
            {needsYou > 0 && (
              <span
                role="img"
                aria-label={`${needsYou} need you`}
                className="shrink-0 rounded-full bg-amber-500 px-1.5 text-[10px] text-white"
              >
                {needsYou}
              </span>
            )}
          </button>
        )}
        {bots.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Your bots will appear here.
          </p>
        )}

        {bots.map((bot) => (
          <div key={bot.id}>
            <div
              className={`group flex w-full items-center gap-2 px-2 py-2 hover:bg-accent/50 ${
                selectedBotId === bot.id ? 'bg-accent' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => select(bot)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <BotAvatar bot={bot} running={Boolean(connectionByBot[bot.id])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{bot.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {bot.title || bot.model || bot.cwd || 'keke'}
                  </span>
                </span>
                {(runningByBot[bot.id] ||
                  statusByBot[bot.id] === 'waiting' ||
                  statusByBot[bot.id] === 'blocked' ||
                  statusByBot[bot.id] === 'failed') && (
                  <span
                    role="img"
                    aria-label={
                      statusByBot[bot.id] === 'waiting'
                        ? 'needs approval'
                        : runningByBot[bot.id]
                          ? 'working'
                          : statusByBot[bot.id]
                    }
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      statusByBot[bot.id] === 'waiting'
                        ? 'animate-pulse bg-amber-500'
                        : runningByBot[bot.id]
                          ? 'animate-pulse bg-primary'
                          : statusByBot[bot.id] === 'failed'
                            ? 'bg-destructive'
                            : 'bg-amber-500'
                    }`}
                  />
                )}
                {bot.unreadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                    {bot.unreadCount}
                  </span>
                )}
              </button>
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                <span className="text-[10px] text-muted-foreground">{since(bot.updatedAt)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
