import { useCallback, useEffect, useMemo, useState } from 'react';
import { type AutomationTask, listAutomations } from '@/services/apiAdapt/automation';
import { type Bot, type BotRun, listBotRuns, updateBot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';

const FINISHED = new Set(['done', 'blocked', 'failed']);

export type TodayRun = BotRun & { bot: Bot };
export type TodayRoutine = { task: AutomationTask; bot: Bot; at: string };

/** A run finished after its bot was last opened: news the person has not seen. */
export function isUnseen(run: BotRun, bot: Bot) {
  if (!run.finishedAt || !FINISHED.has(run.status)) return false;
  return !bot.lastViewedAt || run.finishedAt > bot.lastViewedAt;
}

/**
 * What Today shows: bots waiting on a person, runs finished since each bot was
 * last opened, and the next scheduled runs. Re-read whenever a bot's activity
 * changes, so a run that ends moves from "working" to "done" without a reload.
 */
export function useBotToday() {
  const bots = useBotUiStore((s) => s.bots);
  const statusByBot = useBotUiStore((s) => s.statusByBot);
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [routines, setRoutines] = useState<AutomationTask[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [nextRuns, tasks] = await Promise.all([listBotRuns(200), listAutomations()]);
      setRuns(nextRuns);
      setRoutines(tasks.filter((task) => task.agent === 'bot'));
      setError('');
    } catch (failure) {
      setError(String(failure));
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activity changes are the reload signal
  useEffect(() => {
    void reload();
  }, [reload, statusByBot]);

  const byId = useMemo(() => new Map(bots.map((bot) => [bot.id, bot])), [bots]);

  const waiting = bots.filter((bot) => statusByBot[bot.id] === 'waiting');

  const done: TodayRun[] = runs.flatMap((run) => {
    const bot = byId.get(run.botId);
    return bot && isUnseen(run, bot) ? [{ ...run, bot }] : [];
  });

  const upcoming: TodayRoutine[] = routines
    .flatMap((task) => {
      const bot = task.bot_id ? byId.get(task.bot_id) : undefined;
      return bot && !task.paused && task.next_run_at ? [{ task, bot, at: task.next_run_at }] : [];
    })
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5);

  /** Acknowledge every finished run without opening each bot. */
  const markAllSeen = async () => {
    const now = new Date().toISOString();
    const seen = new Set(done.map((run) => run.botId));
    try {
      for (const id of seen) {
        useBotUiStore
          .getState()
          .upsertBot(await updateBot(id, { unreadCount: 0, lastViewedAt: now }));
      }
    } catch (failure) {
      setError(String(failure));
    }
  };

  return { bots, waiting, done, upcoming, error, reload, markAllSeen };
}

/** "09:00", "Tomorrow 09:00", "Mon 09:00" or a date, for an upcoming run. */
export function whenLabel(iso: string, now = new Date()) {
  const at = new Date(iso);
  const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  if (days <= 0) return time;
  if (days === 1) return `Tomorrow ${time}`;
  if (days < 7) return `${at.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return `${at.toLocaleDateString()} ${time}`;
}

/** "now", "5m ago", "3h ago", "2d ago". */
export function agoLabel(iso: string, now = Date.now()) {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
