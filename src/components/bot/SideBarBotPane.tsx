import { useCallback, useEffect } from 'react';
import { type Bot, listBots } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { BotAvatar } from './BotAvatar';
import { markBotRead } from './markBotRead';
import { useBotSession } from './useBotSession';

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
  const { open } = useBotSession();

  useEffect(() => {
    listBots()
      .then(setBots)
      .catch((e) => console.error('bots: failed to list', e));
  }, [setBots]);

  const select = useCallback(
    (bot: Bot) => {
      setView('bot');
      // Opening the bot is how blocked/failed gets acknowledged.
      const status = useBotUiStore.getState().statusByBot[bot.id];
      if (status === 'blocked' || status === 'failed') {
        useBotUiStore.getState().setBotStatus(bot.id, null);
      }
      void markBotRead(bot);
      void open(bot);
    },
    [open, setView]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
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
                  statusByBot[bot.id] === 'blocked' ||
                  statusByBot[bot.id] === 'failed') && (
                  <span
                    role="img"
                    aria-label={runningByBot[bot.id] ? 'working' : statusByBot[bot.id]}
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      runningByBot[bot.id]
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
