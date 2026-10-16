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
import type { AutomationTask, AutomationTrigger } from '@/services/apiAdapt';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { TriggerFields } from './BotTriggerFields';
import { describeTrigger, makeTrigger, triggerPath } from './routineTrigger';
import { type RoutineDraft, useBotRoutines } from './useBotRoutines';

interface BotRoutinesProps {
  botId: string;
  open: boolean;
}

type Editing = { task?: AutomationTask; form: FormState; trigger: AutomationTrigger | null };

/** Prompts that run as this bot on a schedule or an event: create, edit, pause, delete, run now. */
export function BotRoutines({ botId, open }: BotRoutinesProps) {
  const { routines, loading, save, setPaused, remove, runNow } = useBotRoutines(botId, open);
  // `null` is the list, `undefined` task is a new routine.
  const [editing, setEditing] = useState<Editing | null>(null);

  if (editing) {
    return (
      <RoutineEditor
        botId={botId}
        initial={editing}
        onCancel={() => setEditing(null)}
        onSave={async (draft) => {
          if (await save(draft, editing.task)) setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {loading && routines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : routines.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          No scheduled tasks yet. Schedule a prompt using this bot’s workspace and permissions. Try
          a daily summary of recent repository changes, or a weekly review of TODOs. Results appear
          in this bot’s conversation; tasks need the backend running and awake.
        </p>
      ) : (
        routines.map((task) => (
          <RoutineRow
            key={task.id}
            task={task}
            onRunNow={() => runNow(task)}
            onTogglePaused={() => setPaused(task)}
            onEdit={() =>
              setEditing({ task, form: formFromTask(task), trigger: task.trigger ?? null })
            }
            onDelete={() => remove(task)}
          />
        ))
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setEditing({ form: { ...DEFAULT_FORM, agent: 'bot', botId }, trigger: null })
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        New scheduled task
      </Button>
    </div>
  );
}

function RoutineRow({
  task,
  onRunNow,
  onTogglePaused,
  onEdit,
  onDelete,
}: {
  task: AutomationTask;
  onRunNow: () => void;
  onTogglePaused: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {task.name}
          {task.paused && <span className="ml-2 text-xs text-muted-foreground">paused</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {task.trigger ? describeTrigger(task.trigger) : describeSchedule(task.schedule)}
        </p>
        {task.trigger_error && (
          <p className="truncate text-xs text-destructive" title={task.trigger_error}>
            {task.trigger_error}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Request run now"
        title="Request a run now (results appear in the bot conversation)"
        onClick={onRunNow}
      >
        <Zap className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={task.paused ? 'Resume routine' : 'Pause routine'}
        onClick={onTogglePaused}
      >
        {task.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Edit routine" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive"
        aria-label="Delete routine"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RoutineEditor({
  botId,
  initial,
  onCancel,
  onSave,
}: {
  botId: string;
  initial: Editing;
  onCancel: () => void;
  onSave: (draft: RoutineDraft) => Promise<void>;
}) {
  const [form, setForm] = useState(initial.form);
  const [trigger, setTrigger] = useState(initial.trigger);
  const [saving, setSaving] = useState(false);
  const botCwd = useBotUiStore((s) => s.bots.find((b) => b.id === botId)?.cwd ?? '');

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const triggerReady =
    !trigger ||
    (triggerPath(trigger).trim().length > 0 &&
      (trigger.kind !== 'git_branch' || trigger.branch.trim().length > 0));
  const canSubmit =
    form.name.trim().length > 0 &&
    form.prompt.trim().length > 0 &&
    (trigger ? triggerReady : form.weekdays.length > 0);

  const submit = async () => {
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      prompt: form.prompt.trim(),
      schedule: scheduleFromForm(form),
      trigger,
    });
    setSaving(false);
  };

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
        <Label htmlFor="routine-prompt">What should this bot do?</Label>
        <Textarea
          id="routine-prompt"
          rows={4}
          value={form.prompt}
          placeholder="What the bot should do each time this runs."
          onChange={(e) => setField('prompt', e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label>Runs</Label>
        <div className="flex gap-2" role="radiogroup" aria-label="Runs">
          <Button
            type="button"
            size="sm"
            role="radio"
            aria-checked={!trigger}
            variant={trigger ? 'outline' : 'secondary'}
            onClick={() => setTrigger(null)}
          >
            On a schedule
          </Button>
          <Button
            type="button"
            size="sm"
            role="radio"
            aria-checked={Boolean(trigger)}
            variant={trigger ? 'secondary' : 'outline'}
            onClick={() => setTrigger(trigger ?? makeTrigger('git_branch', botCwd))}
          >
            When something happens
          </Button>
        </div>
      </div>
      {trigger ? (
        <TriggerFields trigger={trigger} onChange={setTrigger} />
      ) : (
        <ScheduleEditor form={form} onChange={setField} />
      )}
      <p className="text-xs text-muted-foreground">
        {trigger
          ? 'Checked while Codexia runs on the backend machine: local changes every 30 seconds, GitHub every 5 minutes through the gh CLI. Changes made while it was closed do not start a run.'
          : 'Uses the backend machine’s local timezone; keep that backend running.'}{' '}
        A step that needs your approval waits for you, and you are notified.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!canSubmit || saving} onClick={submit}>
          {initial.task ? 'Save task' : trigger ? 'Create task' : 'Create scheduled task'}
        </Button>
      </div>
    </div>
  );
}
