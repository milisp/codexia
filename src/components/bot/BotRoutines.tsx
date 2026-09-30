import { Pause, Pencil, Play, Plus, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_FORM } from '@/features/automations/constants';
import { ScheduleEditor } from '@/features/automations/ScheduleEditor';
import type { FormState } from '@/features/automations/types';
import { describeSchedule, formFromTask, scheduleFromForm } from '@/features/automations/utils';
import type { AutomationTask } from '@/services/apiAdapt';
import { useBotRoutines } from './useBotRoutines';

interface BotRoutinesProps {
  botId: string;
  open: boolean;
}

/** Scheduled prompts that run as this bot: create, edit, pause, delete and run now. */
export function BotRoutines({ botId, open }: BotRoutinesProps) {
  const { routines, loading, save, setPaused, remove, runNow } = useBotRoutines(botId, open);
  // `null` is the list, `undefined` task is a new routine.
  const [editing, setEditing] = useState<{ task?: AutomationTask; form: FormState } | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setEditing((prev) => (prev ? { ...prev, form: { ...prev.form, [key]: value } } : prev));

  const submit = async () => {
    if (!editing) return;
    const { form, task } = editing;
    setSaving(true);
    const ok = await save(
      { name: form.name.trim(), prompt: form.prompt.trim(), schedule: scheduleFromForm(form) },
      task
    );
    setSaving(false);
    if (ok) setEditing(null);
  };

  if (editing) {
    const { form, task } = editing;
    const canSubmit =
      form.name.trim().length > 0 && form.prompt.trim().length > 0 && form.weekdays.length > 0;
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="routine-name">Name</Label>
          <Input
            id="routine-name"
            value={form.name}
            placeholder="Morning digest"
            onChange={(e) => setField('name', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="routine-prompt">Prompt</Label>
          <Textarea
            id="routine-prompt"
            rows={4}
            value={form.prompt}
            placeholder="What the bot should do each time this runs."
            onChange={(e) => setField('prompt', e.target.value)}
          />
        </div>
        <ScheduleEditor form={form} onChange={setField} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || saving} onClick={() => void submit()}>
            {task ? 'Save routine' : 'Add routine'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {loading && routines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : routines.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          No routines yet. A routine runs a prompt as this bot on a schedule.
        </p>
      ) : (
        routines.map((task) => (
          <div key={task.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {task.name}
                {task.paused && <span className="ml-2 text-xs text-muted-foreground">paused</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {describeSchedule(task.schedule)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Run now"
              onClick={() => void runNow(task)}
            >
              <Zap className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={task.paused ? 'Resume routine' : 'Pause routine'}
              onClick={() => void setPaused(task)}
            >
              {task.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit routine"
              onClick={() => setEditing({ task, form: formFromTask(task) })}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete routine"
              onClick={() => void remove(task)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditing({ form: { ...DEFAULT_FORM, agent: 'bot', botId } })}
      >
        <Plus className="mr-1 h-4 w-4" />
        New routine
      </Button>
    </div>
  );
}
