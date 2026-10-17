import type { Bot } from '@/services/apiAdapt/bots';
import { BotToday } from './BotToday';
import { BotWelcome } from './BotWelcome';

/**
 * The Bot tab with no bot open: Today, or the first-bot welcome. Nothing is
 * shown until the list has loaded, so an existing bot never flashes the
 * welcome.
 */
export function BotHome({
  bots,
  loaded,
  creating,
  onCreate,
  onSelect,
}: {
  bots: Bot[];
  loaded: boolean;
  creating: boolean;
  onCreate: () => void;
  onSelect: (bot: Bot) => void;
}) {
  if (!loaded) return null;
  if (bots.length === 0) return <BotWelcome creating={creating} onCreate={onCreate} />;
  return <BotToday creating={creating} onCreate={onCreate} onSelect={onSelect} />;
}
