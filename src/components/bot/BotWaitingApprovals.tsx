import { ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  type AcpWaitingApproval,
  acpRespondPermission,
  acpWaitingApprovals,
} from '@/services/apiAdapt/acp';
import { type Bot, parseBotList, updateBot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { approvalKey, approvalLabel } from './approvalKey';

function keyOf(request: AcpWaitingApproval) {
  return approvalKey({ approvalKey: request.approvalKey, ...request.toolCall });
}

/**
 * Steps an unattended run (a scheduled task, another bot's request) is waiting
 * on. The run is paused until one is answered here, from any window or device
 * connected to this backend.
 */
export function BotWaitingApprovals({ bot }: { bot: Bot }) {
  const status = useBotUiStore((s) => s.statusByBot[bot.id]);
  const upsertBot = useBotUiStore((s) => s.upsertBot);
  const [waiting, setWaiting] = useState<AcpWaitingApproval[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    acpWaitingApprovals(bot.id)
      .then(setWaiting)
      .catch((e) => console.error('bots: failed to list waiting approvals', e));
  }, [bot.id]);

  // Re-read whenever the bot's activity changes: `waiting` adds one, and
  // `working`/`done`/`blocked` mean one was answered or withdrawn.
  useEffect(() => {
    refresh();
    // Activity events only mark the first and last waiting step, so a second
    // request that arrives right after the first was answered is picked up
    // by polling while the bot is waiting.
    if (status !== 'waiting') return;
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh, status]);

  if (waiting.length === 0) return null;

  const respond = async (request: AcpWaitingApproval, optionId: string, remember: boolean) => {
    setError(null);
    try {
      await acpRespondPermission(request.connectionId, request.requestId, optionId);
      const key = keyOf(request);
      if (remember && key) {
        const approved = parseBotList(bot.approvedTools);
        if (!approved.includes(key)) {
          upsertBot(await updateBot(bot.id, { approvedTools: [...approved, key] }));
        }
      }
    } catch (e) {
      setError(String(e));
    }
    refresh();
  };

  return (
    <div className="shrink-0 space-y-2 border-t bg-amber-500/5 p-3">
      {waiting.map((request) => {
        const title = request.toolCall?.title ?? 'Permission requested';
        const key = keyOf(request);
        const allow = request.options.find((o) => o.kind === 'allow_once');
        return (
          <div key={request.requestId} className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span className="min-w-0 break-words">{title}</span>
            </div>
            {request.personRequired && (
              <p className="text-xs text-muted-foreground">Needs your approval every time.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {request.options
                .filter((o) => o.kind !== 'allow_always')
                .map((option) => (
                  <Button
                    key={option.optionId}
                    size="sm"
                    variant={option.kind?.startsWith('reject') ? 'ghost' : 'default'}
                    onClick={() => respond(request, option.optionId, false)}
                  >
                    {option.name}
                  </Button>
                ))}
              {!request.personRequired && allow && key && (
                <Button
                  size="sm"
                  variant="outline"
                  title={key}
                  onClick={() => respond(request, allow.optionId, true)}
                >
                  Always allow {approvalLabel(key)}
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
