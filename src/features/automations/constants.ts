import type { AutomationWeekday } from '@/services/tauri';
import type { FormState, TemplateTask } from './types';

export const WEEKDAY_OPTIONS: Array<{ label: string; value: AutomationWeekday }> = [
  { label: 'Su', value: 'sun' },
  { label: 'Mo', value: 'mon' },
  { label: 'Tu', value: 'tue' },
  { label: 'We', value: 'wed' },
  { label: 'Th', value: 'thu' },
  { label: 'Fr', value: 'fri' },
  { label: 'Sa', value: 'sat' },
];

export const DEFAULT_WEEKDAYS: AutomationWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const VALID_WEEKDAYS = new Set(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

export const DEFAULT_FORM: FormState = {
  name: '',
  agent: 'codex',
  modelProvider: 'openai',
  model: '',
  selectedProjects: [],
  prompt: '',
  scheduleMode: 'daily',
  dailyTime: '09:00',
  intervalHours: 6,
  weekdays: DEFAULT_WEEKDAYS,
};

export const BUILTIN_TEMPLATES: TemplateTask[] = [
  {
    id: 'tpl-daily-bug-scan',
    name: 'Daily bug scan',
    description: 'Scan for high-risk regressions every weekday morning.',
    prompt:
      'Run a focused bug scan for high-risk regressions, then report findings with file paths and severity.',
    schedule: {
      mode: 'daily',
      hour: 9,
      minute: 0,
      interval_hours: null,
      weekdays: DEFAULT_WEEKDAYS,
    },
  },
  {
    id: 'tpl-dependency-audit',
    name: 'Nightly dependency audit',
    description: 'Audit dependencies for vulnerabilities each night.',
    prompt:
      'Audit all project dependencies for known CVEs and outdated packages. Report critical issues first.',
    schedule: {
      mode: 'daily',
      hour: 23,
      minute: 0,
      interval_hours: null,
      weekdays: DEFAULT_WEEKDAYS,
    },
  },
  {
    id: 'tpl-hourly-lint',
    name: 'Periodic lint check',
    description: 'Run lint every 4 hours during working hours.',
    prompt: 'Run the linter across all changed files and summarize warnings grouped by rule.',
    schedule: {
      mode: 'interval',
      hour: null,
      minute: null,
      interval_hours: 4,
      weekdays: DEFAULT_WEEKDAYS,
    },
  },
];
