import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { type TaskCompleteBeepMode, type TaskDetail, useSettingsStore } from '@/stores/settings';

export function TaskSettings() {
  const {
    enableTaskCompleteBeep,
    setEnableTaskCompleteBeep,
    preventSleepDuringTasks,
    setPreventSleepDuringTasks,
    showReasoning,
    setShowReasoning,
    taskDetail,
    setTaskDetail,
  } = useSettingsStore();
  const handleTaskDetailChange = (value: string) => setTaskDetail(value as TaskDetail);
  const handleTaskCompleteBeepChange = (value: string) =>
    setEnableTaskCompleteBeep(value as TaskCompleteBeepMode);

  return (
    <div className="w-full px-2 sm:px-4 space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm sm:text-base font-medium">Task</h3>
        <div className="flex flex-col gap-3 sm:gap-4 text-balance">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 sm:p-4">
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium">Task detail</p>
              <p className="text-xs text-muted-foreground">
                Choose how much command output to show in tasks.
              </p>
            </div>
            <Select defaultValue={taskDetail} onValueChange={handleTaskDetailChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="steps">Steps</SelectItem>
                <SelectItem value="stepsWithCommand">Steps with code commands</SelectItem>
                <SelectItem value="stepsWithOutput">Steps with code output</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start justify-between gap-2 sm:gap-4 rounded-md border p-3 sm:p-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">Task completion beep</p>
              <p className="text-xs text-muted-foreground">
                Play a short tone when tasks finish so you can focus away from the screen.
              </p>
            </div>
            <Select value={enableTaskCompleteBeep} onValueChange={handleTaskCompleteBeepChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="unfocused">Only when unfocused</SelectItem>
                <SelectItem value="always">Always</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start justify-between gap-2 sm:gap-4 rounded-md border p-3 sm:p-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">Keep system awake</p>
              <p className="text-xs text-muted-foreground">
                Prevent the computer from sleeping while active tasks run to avoid interruptions.
              </p>
            </div>
            <Switch
              checked={preventSleepDuringTasks}
              onCheckedChange={setPreventSleepDuringTasks}
              className="flex-shrink-0"
            />
          </div>
          <div className="flex items-start justify-between gap-2 sm:gap-4 rounded-md border p-3 sm:p-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">Show reasoning</p>
              <p className="text-xs text-muted-foreground">
                Display agent reasoning events and reasoning summaries in the chat timeline.
              </p>
            </div>
            <Switch
              checked={showReasoning}
              onCheckedChange={setShowReasoning}
              className="flex-shrink-0"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
