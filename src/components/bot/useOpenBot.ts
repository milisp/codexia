import { useCallback } from 'react';
import type { Bot } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { markBotRead } from './markBotRead';
import { useBotSession } from './useBotSession';

/** Open a bot's conversation from a list: the sidebar, Today, the welcome page. */
export function useOpenBot() {
  const setView = useLayoutStore((s) => s.setView);
  const { open } = useBotSession();
  return useCallback(
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
}
