import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { buildEventUrl, isDesktopTauri } from '@/hooks/runtime';
import { notifyDesktop } from '@/lib/notify';
import { track } from '@/lib/telemetry';
import { listBots } from '@/services/apiAdapt/bots';
import { type BotActivityStatus, useBotUiStore } from '@/stores/useBotUiStore';

type BotActivityPayload = { botId: string; sessionId?: string; status: BotActivityStatus };

const MESSAGES: Record<Exclude<BotActivityStatus, 'working'>, (name: string) => string> = {
  done: (name) => `${name} finished`,
  blocked: (name) => `${name} is blocked — needs approval`,
  failed: (name) => `${name} failed`,
};

function handleActivity({ botId, status }: BotActivityPayload) {
  const ui = useBotUiStore.getState();
  if (status === 'working') {
    ui.setBotRunning(botId, true);
    ui.setBotStatus(botId, 'working');
    return;
  }
  if (!(status in MESSAGES)) return;
  ui.setBotRunning(botId, false);
  ui.setBotStatus(botId, status);
  track(`bot_run_${status}`);

  // The backend already bumped `unreadCount`; re-read so the badge shows it.
  listBots()
    .then((bots) => useBotUiStore.getState().setBots(bots))
    .catch((e) => console.error('bots: failed to refresh after activity', e));

  // The user can already see the bot they are looking at.
  if (ui.selectedBotId === botId) return;
  const bot = ui.bots.find((b) => b.id === botId);
  if (!bot?.notificationsEnabled) return;
  const title = MESSAGES[status](bot.name);
  const showToast = () =>
    toast({ title, variant: status === 'failed' ? 'destructive' : undefined });
  // Focused window: in-app toast. Otherwise a system notification (toast as fallback).
  if (document.hasFocus()) showToast();
  else void notifyDesktop(title, undefined, showToast);
}

/**
 * Follows unattended bot runs (routines, bot-to-bot help) via the backend's
 * `bot:activity` event: Tauri event on desktop, `/api/events` SSE elsewhere.
 * Mount once, where the bot list lives.
 */
export function useBotActivity() {
  useEffect(() => {
    if (isDesktopTauri()) {
      const unlisten = listen<BotActivityPayload>('bot:activity', (e) => handleActivity(e.payload));
      return () => {
        void unlisten.then((fn) => fn());
      };
    }

    const es = new EventSource(buildEventUrl('/api/events'));
    es.onmessage = (e) => {
      try {
        const envelope = JSON.parse(e.data as string) as { event?: string; payload?: unknown };
        if (envelope.event === 'bot:activity')
          handleActivity(envelope.payload as BotActivityPayload);
      } catch {}
    };
    return () => es.close();
  }, []);
}
