import { Button } from '@/components/ui/button';
import type { AutomationWeekday } from '@/services/tauri';
import { WEEKDAY_OPTIONS } from './constants';

type WeekdayPickerProps = {
  value: AutomationWeekday[];
  onChange: (weekday: AutomationWeekday) => void;
};

export function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  return (
    <div className="flex gap-1">
      {WEEKDAY_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={value.includes(opt.value) ? 'default' : 'outline'}
          size="xs"
          className="h-7 w-7 rounded-full p-0 text-xs"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
