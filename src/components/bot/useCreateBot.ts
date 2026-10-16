import { useCallback, useRef, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { createAutomation } from '@/services/apiAdapt/automation';
import { type Bot, createBot, updateBot } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { defaultLook, newBotId } from './botDefaults';
import type { BotTemplate } from './botTemplates';

export function useCreateBot() {
  const [newBot, setNewBot] = useState<Bot | null>(null);
  const cwd = useWorkspaceStore((s) => s.cwd);
  const bots = useBotUiStore((s) => s.bots);
  const upsertBot = useBotUiStore((s) => s.upsertBot);
  const setView = useLayoutStore((s) => s.setView);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  const [pickerOpen, setPickerOpen] = useState(false);

  /** "New bot" opens the role picker; the bot is created from what is picked. */
  const handleCreateBot = useCallback(() => setPickerOpen(true), []);

  const createFrom = useCallback(
    async (template: BotTemplate | null, servers: string[]) => {
      if (creatingRef.current) return;
      creatingRef.current = true;
      setCreating(true);
      const look = template ?? defaultLook(bots.length);
      try {
        let bot = await createBot({
          id: newBotId(),
          name: template?.name ?? `Bot ${bots.length + 1}`,
          avatar: look.avatar,
          color: look.color,
          cwd: cwd ?? '',
          trustLevel: template?.trustLevel,
        });
        if (template) {
          bot = await updateBot(bot.id, {
            title: template.title,
            systemPrompt: template.prompt,
            mcpServers: servers,
          });
          if (template.routine) {
            await createAutomation({
              ...template.routine,
              agent: 'bot',
              bot_id: bot.id,
              projects: [],
            });
          }
        }
        upsertBot(bot);
        setPickerOpen(false);
        useAcpStore.getState().reset();
        useAcpStore.getState().setAgentId(bot.agentId);
        useBotUiStore.getState().setSelectedBotId(bot.id);
        setView('bot');
        setNewBot(bot);
      } catch (error) {
        toast({
          title: 'Could not create bot',
          description: String(error),
          variant: 'destructive',
        });
      } finally {
        creatingRef.current = false;
        setCreating(false);
      }
    },
    [bots.length, cwd, setView, upsertBot]
  );

  return { newBot, setNewBot, creating, handleCreateBot, pickerOpen, setPickerOpen, createFrom };
}
