import { CalendarClock, CheckCheck, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Bot } from '@/services/apiAdapt/bots';
import { BotAvatar } from './BotAvatar';
import { BotInboxCard } from './BotInboxCard';
import { BotWaitingApprovals } from './BotWaitingApprovals';
import { triggerLabel } from './triggerLabel';
import { agoLabel, useBotToday, whenLabel } from './useBotToday';

const STATUS_BADGE: Record<string, { label: string; variant: 'destructive' | 'outline' }> = {
  blocked: { label: 'Blocked', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
};

interface BotTodayProps {
  creating: boolean;
  onCreate: () => void;
  onSelect: (bot: Bot) => void;
}

/**
 * Where you arrive when no bot is open: what needs you, what finished since
 * you last looked, and what runs next. Only actionable or new items appear.
 */
export function BotToday({ creating, onCreate, onSelect }: BotTodayProps) {
  const { bots, waiting, inbox, done, upcoming, error, markAllSeen } = useBotToday();
  const needsYou = waiting.length + inbox.length;
  const empty = needsYou === 0 && done.length === 0;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Today</h1>
          <Button variant="outline" size="sm" disabled={creating} onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {creating ? 'Creating…' : 'New bot'}
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        {empty && (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing needs you right now.
          </p>
        )}

        {needsYou > 0 && (
          <Section title="Needs you" count={needsYou}>
            {waiting.map((bot) => (
              <div key={bot.id} className="rounded-lg border border-amber-500/40 bg-amber-500/5">
                <BotHeader bot={bot} onSelect={onSelect} />
                <BotWaitingApprovals bot={bot} className="px-3 pb-3" />
              </div>
            ))}
            {inbox.map(({ item, bot }) => (
              <div key={item.id} className="rounded-lg border">
                <BotHeader bot={bot} onSelect={onSelect} />
                <div className="px-3 pb-3">
                  <BotInboxCard item={item} />
                </div>
              </div>
            ))}
          </Section>
        )}

        {done.length > 0 && (
          <Section
            title="Done since you looked"
            count={done.length}
            action={
              <Button variant="ghost" size="sm" onClick={() => void markAllSeen()}>
                <CheckCheck className="h-4 w-4" />
                Mark all seen
              </Button>
            }
          >
            <div className="divide-y rounded-lg border">
              {done.map((run) => {
                const badge = STATUS_BADGE[run.status];
                return (
                  <button
                    key={run.runId}
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-accent/50"
                    onClick={() => onSelect(run.bot)}
                  >
                    <BotAvatar bot={run.bot} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="truncate font-medium">{run.bot.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {triggerLabel(run.triggerKind, run.triggerName)}
                        </span>
                        {badge && (
                          <Badge variant={badge.variant} className="shrink-0">
                            {badge.label}
                          </Badge>
                        )}
                      </span>
                      {run.summary && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                          {run.summary}
                        </span>
                      )}
                    </span>
                    {run.finishedAt && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {agoLabel(run.finishedAt)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Coming up">
            <div className="divide-y rounded-lg border">
              {upcoming.map(({ task, bot, at }) => (
                <button
                  key={task.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50"
                  onClick={() => onSelect(bot)}
                >
                  <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{task.name}</span>
                    <span className="text-muted-foreground"> · {bot.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{whenLabel(at)}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Scheduled runs happen only while Codexia is open on this computer.
            </p>
          </Section>
        )}

        {bots.length > 0 && (
          <Section title="Bots">
            <div className="grid gap-2 sm:grid-cols-2">
              {bots.map((item) => (
                <Button
                  key={item.id}
                  aria-label={`Open ${item.name}`}
                  variant="outline"
                  className="h-auto justify-start gap-3 px-3 py-2 text-left"
                  onClick={() => onSelect(item)}
                >
                  <BotAvatar bot={item} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    {item.title && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.title}
                      </span>
                    )}
                  </span>
                </Button>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2" aria-label={title}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          {title}
          {count ? <span className="ml-1.5 text-muted-foreground">{count}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function BotHeader({ bot, onSelect }: { bot: Bot; onSelect: (bot: Bot) => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 pt-3 pb-2 text-left"
      onClick={() => onSelect(bot)}
    >
      <BotAvatar bot={bot} size="sm" />
      <span className="truncate text-sm font-medium">{bot.name}</span>
    </button>
  );
}
