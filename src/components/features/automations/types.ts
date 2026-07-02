import type { AutomationSchedule, AutomationTask, AutomationWeekday } from '@/services/tauri';
import type { Provider } from '@/stores/settings';

export type FormState = {
  name: string;
  agent: 'codex' | 'cc';
  modelProvider: Provider;
  model: string;
  selectedProjects: string[];
  prompt: string;
  scheduleMode: 'daily' | 'interval';
  dailyTime: string;
  intervalHours: number;
  weekdays: AutomationWeekday[];
};

export type TemplateTask = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  schedule: AutomationSchedule;
};

/** Unified dialog mode — replaces the old createOpen + managedTask pair */
export type DialogMode =
  | { type: 'create'; initialForm?: Partial<FormState> }
  | { type: 'edit'; task: AutomationTask }
  | null;
