import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import type { AutomationSchedule, AutomationTask } from '@/services/tauri';
import {
  createAutomation,
  deleteAutomation,
  setAutomationPaused,
  updateAutomation,
} from '@/services/tauri';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CodexModelSelector } from '@/components/codex/selector';
import { useConfigStore } from '@/components/codex/stores';
import { useCCStore } from '@/stores/cc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/utils/errorUtils';
import { getFilename } from '@/utils/getFilename';
import { DEFAULT_FORM } from './constants';
import { ScheduleEditor } from './ScheduleEditor';
import type { DialogMode, FormState } from './types';
import { formFromTask } from './utils';


type ManageDialogProps = {
  mode: DialogMode;
  onClose: () => void;
  onCreated?: (task: AutomationTask) => void;
  onUpdated: (task: AutomationTask) => void;
  onDeleted: (id: string) => void;
};

export function ManageDialog({
  mode,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: ManageDialogProps) {
  const { projects } = useWorkspaceStore();
  const open = mode !== null;
  const isCreate = mode?.type === 'create';
  const isEdit = mode?.type === 'edit';
  const existingTask = isEdit ? mode.task : null;

  const [isMutating, setIsMutating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [projectSelectOpen, setProjectSelectOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });

  const getDefaultModel = useCallback(
    (agent: 'codex' | 'cc', provider: string): string => {
      if (agent === 'cc') {
        return useCCStore.getState().options.model ?? 'sonnet';
      }
      return useConfigStore.getState().providerModels[provider] ?? '';
    },
    []
  );

  // Reset state whenever the dialog opens or mode changes
  useEffect(() => {
    if (!open) return;
    setLastError(null);
    setConfirmDelete(false);
    setProjectSelectOpen(false);

    if (isCreate) {
      const initial = { ...DEFAULT_FORM, ...(mode.initialForm ?? {}) };
      const modelProvider = initial.modelProvider ?? 'openai';
      setForm({
        ...initial,
        modelProvider,
        model: initial.model || getDefaultModel(initial.agent, modelProvider),
      });
    } else if (existingTask) {
      setForm(formFromTask(existingTask));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode?.type, existingTask?.id, getDefaultModel]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleProject = (project: string) => {
    setForm((prev) => ({
      ...prev,
      selectedProjects: prev.selectedProjects.includes(project)
        ? prev.selectedProjects.filter((p) => p !== project)
        : [...prev.selectedProjects, project],
    }));
  };

  const canSubmit = useMemo(
    () =>
      form.name.trim().length > 0 &&
      form.prompt.trim().length > 0 &&
      form.weekdays.length > 0 &&
      form.model.trim().length > 0,
    [form.name, form.prompt, form.weekdays.length, form.model]
  );

  const buildSchedule = (): AutomationSchedule =>
    (() => {
      if (form.scheduleMode === 'daily') {
        const [hourPart, minutePart] = form.dailyTime.split(':');
        const hour = Number(hourPart);
        const minute = Number(minutePart);
        return {
          mode: 'daily' as const,
          hour: Number.isFinite(hour) ? hour : 9,
          minute: Number.isFinite(minute) ? minute : 0,
          interval_hours: null,
          weekdays: form.weekdays,
        };
      }
      return {
        mode: 'interval' as const,
        hour: null,
        minute: null,
        interval_hours: form.intervalHours,
        weekdays: form.weekdays,
      };
    })();

  const handleCreate = async () => {
    if (!canSubmit) return;
    setIsMutating(true);
    setLastError(null);
    try {
      const created = await createAutomation({
        name: form.name.trim(),
        projects: form.selectedProjects,
        prompt: form.prompt.trim(),
        schedule: buildSchedule(),
        agent: form.agent,
        model_provider: form.modelProvider,
        model: form.model,
      });
      onCreated?.(created);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      toast({ title: 'Create failed', description: message, variant: 'destructive' });
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!existingTask || !canSubmit) return;
    setIsMutating(true);
    setLastError(null);
    try {
      const updated = await updateAutomation({
        id: existingTask.id,
        name: form.name.trim(),
        projects: form.selectedProjects,
        prompt: form.prompt.trim(),
        schedule: buildSchedule(),
        agent: form.agent,
        model_provider: form.modelProvider,
        model: form.model,
      });
      onUpdated(updated);
      toast({ title: 'Automation updated' });
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveAndResume = async () => {
    if (!existingTask || !canSubmit) return;
    setIsMutating(true);
    setLastError(null);
    try {
      const updated = await updateAutomation({
        id: existingTask.id,
        name: form.name.trim(),
        projects: form.selectedProjects,
        prompt: form.prompt.trim(),
        schedule: buildSchedule(),
        agent: form.agent,
        model_provider: form.modelProvider,
        model: form.model,
      });
      const resumed = updated.paused ? await setAutomationPaused(updated.id, false) : updated;
      onUpdated(resumed);
      toast({ title: 'Automation updated and resumed' });
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    } finally {
      setIsMutating(false);
    }
  };

  const handleTogglePause = async () => {
    if (!existingTask) return;
    setIsMutating(true);
    try {
      const updated = await setAutomationPaused(existingTask.id, !existingTask.paused);
      onUpdated(updated);
    } catch (error) {
      const message = getErrorMessage(error);
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!existingTask) return;
    setIsMutating(true);
    setLastError(null);
    try {
      await deleteAutomation(existingTask.id);
      onDeleted(existingTask.id);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      toast({ title: 'Delete failed', description: message, variant: 'destructive' });
    } finally {
      setIsMutating(false);
      setConfirmDelete(false);
    }
  };

  if (!open) return null;

  const allProjectOptions = [...new Set([...projects, ...form.selectedProjects])];
  const selectedProjectLine = form.selectedProjects
    .map((project) => getFilename(project) || project)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreate ? (
              'New automation'
            ) : (
              <>
                <span className="truncate">{existingTask?.name}</span>
                {existingTask?.paused && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    Paused
                  </span>
                )}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Set up a scheduled AI task for your workspace.'
              : 'Edit automation settings below, then save changes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lastError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {lastError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="manage-name">Name</Label>
            <Input
              id="manage-name"
              placeholder="Nightly dependency audit"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>

          <Label>Model</Label>
          <div className="flex">
            <Select
              value={form.agent}
              onValueChange={(value) => {
                const nextAgent = value as 'codex' | 'cc';
                setForm((prev) => ({
                  ...prev,
                  agent: nextAgent,
                  model: getDefaultModel(nextAgent, prev.modelProvider),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="cc">Claude</SelectItem>
              </SelectContent>
            </Select>
            {form.agent === 'codex' ? (
              <span className="flex">
                <CodexModelSelector
                  provider={form.modelProvider}
                  onProviderChange={(value) => {
                    setForm((prev) => ({
                      ...prev,
                      modelProvider: value,
                      model: getDefaultModel(prev.agent, value),
                    }));
                  }}
                  value={form.model}
                  onValueChange={(value: string) => setField('model', value)}
                />
              </span>
            ) : (
              <Select value={form.model} onValueChange={(value) => setField('model', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sonnet">sonnet</SelectItem>
                  <SelectItem value="opus">opus</SelectItem>
                  <SelectItem value="haiku">haiku</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Projects</Label>
            <Popover
              open={projectSelectOpen}
              onOpenChange={(nextOpen) => {
                setProjectSelectOpen(nextOpen);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between gap-2 font-normal"
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {selectedProjectLine || 'Select projects'}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search projects..." />
                  <CommandList className="max-h-56">
                    <CommandEmpty>
                      {isCreate
                        ? 'No workspace projects found. Add projects from the sidebar first.'
                        : 'No projects available.'}
                    </CommandEmpty>
                    {allProjectOptions.length > 0 && (
                      <CommandGroup heading="Select projects">
                        {allProjectOptions.map((project) => {
                          const isSelected = form.selectedProjects.includes(project);
                          return (
                            <CommandItem
                              key={project}
                              onSelect={() => toggleProject(project)}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{getFilename(project) || project}</span>
                              {isSelected && <Check className="h-4 w-4 text-primary" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manage-prompt">Prompt</Label>
            <Textarea
              id="manage-prompt"
              value={form.prompt}
              onChange={(e) => setField('prompt', e.target.value)}
              className="min-h-24"
            />
          </div>

          <ScheduleEditor form={form} onChange={setField} />
        </div>

        {/* Footer varies by mode + sub-state */}
        {isCreate ? (
          <DialogFooter>
            <Button variant="ghost" disabled={isMutating} onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={!canSubmit || isMutating}>
              {isMutating ? 'Adding...' : 'Add automation'}
            </Button>
          </DialogFooter>
        ) : confirmDelete ? (
          <DialogFooter className="gap-2">
            <span className="mr-auto self-center text-sm text-muted-foreground">
              Sure? This cannot be undone.
            </span>
            <Button variant="ghost" disabled={isMutating} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isMutating} onClick={() => void handleDelete()}>
              {isMutating ? 'Deleting...' : 'Yes, delete'}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              disabled={isMutating}
              onClick={() => setConfirmDelete(true)}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              variant="outline"
              disabled={isMutating}
              onClick={() => void handleTogglePause()}
            >
              {existingTask?.paused ? 'Resume' : 'Pause'}
            </Button>
            {existingTask?.paused && (
              <Button
                variant="secondary"
                onClick={() => void handleSaveAndResume()}
                disabled={!canSubmit || isMutating}
              >
                {isMutating ? 'Saving...' : 'Save & Resume'}
              </Button>
            )}
            <Button onClick={() => void handleSaveEdit()} disabled={!canSubmit || isMutating}>
              {isMutating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
