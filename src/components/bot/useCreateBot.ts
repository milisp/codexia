import { useCallback, useRef, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { type Bot, createBot } from '@/services/apiAdapt/bots';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { defaultLook, newBotId } from './botDefaults';

export function useCreateBot() {
  const [newBot, setNewBot] = useState<Bot | null>(null);
  const cwd = useWorkspaceStore((s) => s.cwd);
  const bots = useBotUiStore((s) => s.bots);
  const upsertBot = useBotUiStore((s) => s.upsertBot);
  const setView = useLayoutStore((s) => s.setView);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  const handleCreateBot = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    const look = defaultLook(bots.length);
    try {
      const bot = await createBot({
        id: newBotId(),
        name: `Bot ${bots.length + 1}`,
        avatar: look.avatar,
        color: look.color,
        cwd: cwd ?? '',
      });
      upsertBot(bot);
      useAcpStore.getState().reset();
      useAcpStore.getState().setAgentId(bot.agentId);
      useBotUiStore.getState().setSelectedBotId(bot.id);
      setView('bot');
      setNewBot(bot);
    } catch (error) {
      toast({ title: 'Could not create bot', description: String(error), variant: 'destructive' });
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [bots.length, cwd, setView, upsertBot]);

  return { newBot, setNewBot, creating, handleCreateBot };
}
