import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useBotUiStore } from '@/stores/useBotUiStore';

interface BotCollaborationFieldsProps {
  botId: string;
  allowedBotIds: string[];
  onAllowedBotIdsChange: (ids: string[]) => void;
}

export function BotCollaborationFields({
  botId,
  allowedBotIds,
  onAllowedBotIdsChange,
}: BotCollaborationFieldsProps) {
  const bots = useBotUiStore((state) => state.bots);
  const targets = bots.filter((bot) => bot.id !== botId && !bot.archived);
  return (
    <div className="space-y-2">
      <Label>Bot collaboration</Label>
      <p className="text-xs text-muted-foreground">
        Allow this bot to list and ask selected bots. None are allowed by default. Each target uses
        its own permissions and cannot delegate this request further.
      </p>
      {targets.length === 0 && (
        <p className="text-xs text-muted-foreground">No other active bots.</p>
      )}
      {targets.map((bot) => (
        <Label key={bot.id} className="flex items-center gap-2">
          <Checkbox
            checked={allowedBotIds.includes(bot.id)}
            onCheckedChange={(checked) =>
              onAllowedBotIdsChange(
                checked === true
                  ? [...new Set([...allowedBotIds, bot.id])]
                  : allowedBotIds.filter((id) => id !== bot.id)
              )
            }
          />
          {bot.name}
        </Label>
      ))}
    </div>
  );
}
