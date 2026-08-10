import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AutomationWeekday } from '@/services/apiAdapt';
import type { FormState } from './types';
import { clampHour, clampIntervalHours, clampMinute, INTERVAL_HOURS_OPTIONS } from './utils';
import { WeekdayPicker } from './WeekdayPicker';

type ScheduleEditorProps = {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};

export function ScheduleEditor({ form, onChange }: ScheduleEditorProps) {
  const toggleWeekday = (weekday: AutomationWeekday) => {
    const next = form.weekdays.includes(weekday)
      ? form.weekdays.filter((d) => d !== weekday)
      : [...form.weekdays, weekday];
    onChange('weekdays', next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Schedule</Label>
        <Tabs
          value={form.scheduleMode}
          onValueChange={(value) => onChange('scheduleMode', value as 'daily' | 'interval')}
        >
          <TabsList className="h-8">
            <TabsTrigger value="daily" className="text-xs">
              daily
            </TabsTrigger>
            <TabsTrigger value="interval" className="justify-center text-center text-xs">
              interval
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={form.scheduleMode}>
        <TabsContent value="daily" className="mt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="daily-time"
              type="time"
              step={60}
              value={form.dailyTime}
              onChange={(e) => {
                const [hourPart, minutePart] = e.target.value.split(':');
                const nextHour = clampHour(Number(hourPart ?? '0'));
                const nextMinute = clampMinute(Number(minutePart ?? '0'));
                onChange(
                  'dailyTime',
                  `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`
                );
              }}
            />
            <WeekdayPicker value={form.weekdays} onChange={toggleWeekday} />
          </div>
        </TabsContent>

        <TabsContent value="interval">
          <div className="flex items-center gap-2 text-center">
            <span>Run every</span>
            <Select
              value={String(form.intervalHours)}
              onValueChange={(value) =>
                onChange('intervalHours', clampIntervalHours(Number(value)))
              }
            >
              <SelectTrigger id="interval-hours" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_HOURS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>hours on</span>
            <WeekdayPicker value={form.weekdays} onChange={toggleWeekday} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
