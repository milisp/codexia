import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type Bot, parseBotList } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { usePluginsNavigationStore } from '@/stores/usePluginsNavigationStore';
import { BotMcpFields } from './BotMcpFields';
import { saveBotSettings } from './saveBotSettings';

export function BotToolsMenu({ bot }: { bot: Bot }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const running = useBotUiStore((state) => Boolean(state.runningByBot[bot.id]));
  const save = async (next: string[]) => {
    if (saving || running) return false;
    setSaving(true);
    try {
      await saveBotSettings(bot, { mcpServers: next });
      setSelected(next);
      return true;
    } catch (error) {
      toast.error(`Could not save tools: ${error}`);
      return false;
    } finally {
      setSaving(false);
    }
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next) setSelected(parseBotList(bot.mcpServers));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label="Bot tools"
          title="Bot tools"
        >
          <Plus />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
        <div className="flex flex-col gap-3">
          <BotMcpFields
            compact
            mcpServers={selected}
            onMcpServersChange={(next) => {
              save(next);
            }}
            disabled={saving || running}
            onManageTools={async () => {
              setOpen(false);
              usePluginsNavigationStore.getState().openBotConnectors();
              useLayoutStore.getState().setView('plugins');
            }}
          />
          {running && (
            <p className="text-xs text-muted-foreground">Stop the current task to change tools.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
