import { BotInboxCard } from './BotInboxCard';
import { useBotInbox } from './useBotInbox';

/** One bot's open drafts and hand-backs, above its composer. */
export function BotInbox({ botId }: { botId: string }) {
  const { items } = useBotInbox(botId);
  if (items.length === 0) return null;
  return (
    <div className="max-h-[50vh] shrink-0 space-y-2 overflow-y-auto border-t bg-muted/30 p-3">
      {items.map((item) => (
        <BotInboxCard key={item.id} item={item} />
      ))}
    </div>
  );
}
