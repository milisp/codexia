import type { AutomationSchedule, AutomationTask, AutomationWeekday } from '@/services/tauri';
import { VALID_WEEKDAYS } from './constants';
import type { FormState, TemplateTask } from './types';

export function normalizeWeekdays(value: string[]): AutomationWeekday[] {
  return value
    .map((item) => item.toLowerCase())
    .filter((item): item is AutomationWeekday => VALID_WEEKDAYS.has(item));
}

export function clampHour(value: number): number {
  return Math.min(23, Math.max(0, value));
}

export function clampMinute(value: number): number {
  return Math.min(59, Math.max(0, value));
}

export function clampIntervalHours(value: number): number {
  return Math.min(24, Math.max(1, value));
}

function toDailyTime(hour?: number | null, minute?: number | null): string {
  const safeHour = clampHour(Number(hour ?? 9));
  const safeMinute = clampMinute(Number(minute ?? 0));
  return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
}

export function formFromTask(task: AutomationTask): FormState {
  return {
    name: task.name,
    agent: task.agent,
    modelProvider: task.model_provider ?? 'openai',
    model: task.model ?? '',
    selectedProjects: task.projects,
    prompt: task.prompt,
    scheduleMode: task.schedule.mode,
    dailyTime: toDailyTime(task.schedule.hour, task.schedule.minute),
    intervalHours: task.schedule.interval_hours ?? 6,
    weekdays: normalizeWeekdays(task.schedule.weekdays),
  };
}

export function formFromTemplate(template: TemplateTask): FormState {
  return {
    name: template.name,
    agent: 'codex',
    modelProvider: 'openai',
    model: '',
    selectedProjects: [],
    prompt: template.prompt,
    scheduleMode: template.schedule.mode,
    dailyTime: toDailyTime(template.schedule.hour, template.schedule.minute),
    intervalHours: template.schedule.interval_hours ?? 6,
    weekdays: normalizeWeekdays(template.schedule.weekdays),
  };
}

export function describeSchedule(schedule: AutomationSchedule): string {
  if (schedule.mode === 'interval') {
    return `Every ${schedule.interval_hours}h`;
  }
  const minute = schedule.minute ?? 0;
  const minuteLabel = minute.toString().padStart(2, '0');
  const days = schedule.weekdays.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
  return `Daily ${schedule.hour}:${minuteLabel} · ${days}`;
}

const WEEKDAY_INDEX: Record<AutomationWeekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function isAllowedWeekday(weekdays: AutomationWeekday[], date: Date): boolean {
  if (weekdays.length === 0) return false;
  const dayIndex = date.getDay();
  return weekdays.some((weekday) => WEEKDAY_INDEX[weekday] === dayIndex);
}

function nextDailyRun(schedule: AutomationSchedule, now: Date): Date {
  const hour = schedule.hour ?? 0;
  const minute = schedule.minute ?? 0;
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (isAllowedWeekday(schedule.weekdays, candidate) && candidate > now) {
      return candidate;
    }
  }
  const fallback = new Date(now);
  fallback.setHours(hour, minute, 0, 0);
  fallback.setDate(fallback.getDate() + 1);
  return fallback;
}

function nextIntervalRun(schedule: AutomationSchedule, now: Date): Date {
  const intervalHours = schedule.interval_hours ?? 1;
  const intervalSeconds = Math.max(1, intervalHours) * 3600;

  for (let offset = 0; offset < 15; offset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    day.setHours(0, 0, 0, 0);

    if (!isAllowedWeekday(schedule.weekdays, day)) {
      continue;
    }

    if (offset === 0) {
      const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const nextSlotSeconds =
        Math.ceil((secondsSinceMidnight + 1) / intervalSeconds) * intervalSeconds;
      if (nextSlotSeconds < 86400) {
        const candidate = new Date(day.getTime() + nextSlotSeconds * 1000);
        if (candidate > now) {
          return candidate;
        }
      }
      continue;
    }

    return day;
  }

  const fallback = new Date(now.getTime() + intervalHours * 3600 * 1000);
  return fallback;
}

export function getNextRunAt(schedule: AutomationSchedule, now: Date): Date {
  if (schedule.mode === 'interval') {
    return nextIntervalRun(schedule, now);
  }
  return nextDailyRun(schedule, now);
}

export function formatStartsIn(target: Date, now: Date): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours >= 1) {
    return `${hours}h`;
  }
  if (minutes >= 1) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}
