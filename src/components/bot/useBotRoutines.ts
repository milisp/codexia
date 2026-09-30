import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  type AutomationTask,
  createAutomation,
  deleteAutomation,
  listAutomations,
  runAutomationNow,
  setAutomationPaused,
  updateAutomation,
} from '@/services/apiAdapt';
import { getErrorMessage } from '@/utils/errorUtils';

export type RoutineDraft = Pick<AutomationTask, 'name' | 'prompt' | 'schedule'>;

function fail(title: string, error: unknown) {
  toast({ title, description: getErrorMessage(error), variant: 'destructive' });
}

/** The automation tasks that run as one bot, with the actions the routines list needs. */
export function useBotRoutines(botId: string, open: boolean) {
  const [routines, setRoutines] = useState<AutomationTask[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listAutomations();
      setRoutines(all.filter((task) => task.agent === 'bot' && task.bot_id === botId));
    } catch (error) {
      fail('Could not load routines', error);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const replace = (task: AutomationTask) =>
    setRoutines((prev) => prev.map((r) => (r.id === task.id ? task : r)));

  const save = async (draft: RoutineDraft, existing?: AutomationTask) => {
    try {
      if (existing) {
        replace(
          await updateAutomation({
            id: existing.id,
            ...draft,
            projects: existing.projects,
            agent: 'bot',
            bot_id: botId,
            model_provider: existing.model_provider,
            model: existing.model,
            cwd_mode: existing.cwd_mode,
          })
        );
      } else {
        const created = await createAutomation({
          ...draft,
          agent: 'bot',
          bot_id: botId,
          projects: [],
        });
        setRoutines((prev) => [...prev, created]);
      }
      return true;
    } catch (error) {
      fail('Could not save routine', error);
      return false;
    }
  };

  const setPaused = async (task: AutomationTask) => {
    try {
      replace(await setAutomationPaused(task.id, !task.paused));
    } catch (error) {
      fail('Could not update routine', error);
    }
  };

  const remove = async (task: AutomationTask) => {
    try {
      await deleteAutomation(task.id);
      setRoutines((prev) => prev.filter((r) => r.id !== task.id));
    } catch (error) {
      fail('Could not delete routine', error);
    }
  };

  const runNow = async (task: AutomationTask) => {
    try {
      await runAutomationNow(task.id);
      toast({ title: 'Routine started', description: task.name });
    } catch (error) {
      fail('Could not run routine', error);
    }
  };

  return { routines, loading, save, setPaused, remove, runNow };
}
