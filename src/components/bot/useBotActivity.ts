import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { buildEventUrl, isDesktopTauri } from '@/hooks/runtime';
import { notifyDesktop } from '@/lib/notify';
import { acpWaitingApprovals } from '@/services/apiAdapt/acp';
import { type BotInboxItem, listBots } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { type BotActivityStatus, useBotUiStore } from '@/stores/useBotUiStore';
import { markBotRead } from './markBotRead';

type BotActivityPayload = { botId: string; sessionId?: string; status: BotActivityStatus };

const MESSAGES: Record<Exclude<BotActivityStatus, 'working'>, (name: string) => string> = {
  waiting: (name) => `${name} needs your approval`,
  done: (name) => `${name} finished`,
  blocked: (name) => `${name} stopped — a step was not approved`,
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
  // Waiting is still a run in progress: it resumes once the person answers.
  ui.setBotRunning(botId, status === 'waiting');
  ui.setBotStatus(botId, status);

  // The backend already bumped `unreadCount`; re-read so the badge shows it —
  // unless the bot is open, in which case the reply has already been seen.
  if (status !== 'waiting') refreshAfterRun(botId);

  // The user can already see the bot they are looking at.
  if (useLayoutStore.getState().view === 'bot' && ui.selectedBotId === botId) return;
  const bot = ui.bots.find((b) => b.id === botId);
  if (!bot?.notificationsEnabled) return;
  const title = MESSAGES[status](bot.name);
  const showToast = () =>
    toast({ title, variant: status === 'failed' ? 'destructive' : undefined });
  // Focused window: in-app toast. Otherwise a system notification (toast as fallback).
  if (document.hasFocus()) showToast();
  else void notifyDesktop(title, undefined, showToast);
}

type BotInboxPayload = { botId: string; item?: BotInboxItem };

/** A bot left a draft or handed a step back, or one was handled elsewhere. */
function handleInbox({ botId, item }: BotInboxPayload) {
  const ui = useBotUiStore.getState();
  ui.bumpInbox();
  if (item?.status !== 'open') return;
  if (useLayoutStore.getState().view === 'bot' && ui.selectedBotId === botId) return;
  const bot = ui.bots.find((b) => b.id === botId);
  if (!bot?.notificationsEnabled) return;
  const title =
    item.kind === 'draft' ? `${bot.name} wrote a draft for you` : `${bot.name} needs you`;
  const showToast = () => toast({ title, description: item.title });
  if (document.hasFocus()) showToast();
  else void notifyDesktop(title, item.title, showToast);
}

function refreshAfterRun(botId: string) {
  listBots()
    .then((bots) => {
      useBotUiStore.getState().setBots(bots);
      const bot = bots.find((b) => b.id === botId);
      if (
        bot &&
        useLayoutStore.getState().view === 'bot' &&
        useBotUiStore.getState().selectedBotId === botId
      )
        void markBotRead(bot);
    })
    .catch((e) => console.error('bots: failed to refresh after activity', e));
}

/**
 * Marks bots whose unattended run is waiting for a person. `bot:activity` is
 * only seen live, so a client that opens or reconnects mid-wait (a reload, a
 * phone over remote access) asks the backend instead.
 */
function restoreWaiting() {
  acpWaitingApprovals()
    .then((waiting) => {
      const ui = useBotUiStore.getState();
      for (const botId of new Set(waiting.map((w) => w.botId))) {
        if (!botId) continue;
        ui.setBotRunning(botId, true);
        ui.setBotStatus(botId, 'waiting');
      }
    })
    .catch((e) => console.error('bots: failed to read waiting approvals', e));
}

/**
 * Follows unattended bot runs (routines, bot-to-bot help) via the backend's
 * `bot:activity` event: Tauri event on desktop, `/api/events` SSE elsewhere.
 * Mount once, where the bot list lives.
 */
export function useBotActivity() {
  useEffect(() => {
    if (isDesktopTauri()) {
      restoreWaiting();
      const stops = [
        listen<BotActivityPayload>('bot:activity', (e) => handleActivity(e.payload)),
        listen<BotInboxPayload>('bot:inbox', (e) => handleInbox(e.payload)),
      ];
      return () => {
        for (const stop of stops) void stop.then((fn) => fn());
      };
    }

    const es = new EventSource(buildEventUrl('/api/events'));
    // Events sent while disconnected are lost; catch up on what still waits.
    es.onopen = () => {
      restoreWaiting();
      useBotUiStore.getState().bumpInbox();
    };
    es.onmessage = (e) => {
      try {
        const envelope = JSON.parse(e.data as string) as { event?: string; payload?: unknown };
        if (envelope.event === 'bot:activity')
          handleActivity(envelope.payload as BotActivityPayload);
        else if (envelope.event === 'bot:inbox') handleInbox(envelope.payload as BotInboxPayload);
      } catch {}
    };
    return () => es.close();
  }, []);
}
