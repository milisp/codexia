import type { Provider } from '@/stores/settings';
import { dual, dualVoid } from './shared';

export type AutomationScheduleMode = 'daily' | 'interval';
export type AutomationWeekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type AutomationSchedule = {
  mode: AutomationScheduleMode;
  hour?: number | null;
  minute?: number | null;
  interval_hours?: number | null;
  weekdays: AutomationWeekday[];
};

export type AutomationTask = {
  id: string;
  name: string;
  projects: string[];
  prompt: string;
  agent: 'codex' | 'cc';
  model_provider: Provider;
  model: string;
  schedule: AutomationSchedule;
  cron_expression: string;
  created_at: string;
  paused: boolean;
};

export type AutomationRun = {
  run_id: string;
  task_id: string;
  task_name: string;
  thread_id: string;
  status: string;
  started_at: string;
  updated_at: string;
};

export async function listAutomations() {
  return await dual<AutomationTask[]>('list_automations', undefined, '/api/automation/list', {});
}

export async function listAutomationRuns(payload?: { task_id?: string; limit?: number }) {
  const params = { task_id: payload?.task_id ?? null, limit: payload?.limit ?? 100 };
  return await dual<AutomationRun[]>(
    'list_automation_runs',
    params,
    '/api/automation/runs/list',
    params
  );
}

export async function createAutomation(payload: {
  name: string;
  projects: string[];
  prompt: string;
  schedule: AutomationSchedule;
  agent?: 'codex' | 'cc';
  model_provider?: string;
  model?: string;
}) {
  return await dual<AutomationTask>(
    'create_automation',
    { ...payload, modelProvider: payload.model_provider },
    '/api/automation/create',
    payload
  );
}

export async function updateAutomation(payload: {
  id: string;
  name: string;
  projects: string[];
  prompt: string;
  schedule: AutomationSchedule;
  agent?: 'codex' | 'cc';
  model_provider?: string;
  model?: string;
}) {
  return await dual<AutomationTask>(
    'update_automation',
    { ...payload, modelProvider: payload.model_provider },
    '/api/automation/update',
    payload
  );
}

export async function setAutomationPaused(id: string, paused: boolean) {
  return await dual<AutomationTask>(
    'set_automation_paused',
    { id, paused },
    '/api/automation/set-paused',
    { id, paused }
  );
}

export async function deleteAutomation(id: string) {
  await dualVoid('delete_automation', { id }, '/api/automation/delete', { id });
}

export async function runAutomationNow(id: string) {
  await dualVoid('run_automation_now', { id }, '/api/automation/run-now', { id });
}
