import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AutomationTrigger } from '@/services/apiAdapt/automation';
import { makeTrigger, TRIGGER_KINDS, type TriggerKind, triggerPath } from './routineTrigger';

/** The event a routine waits for, and where it looks. */
export function TriggerFields({
  trigger,
  onChange,
}: {
  trigger: AutomationTrigger;
  onChange: (trigger: AutomationTrigger) => void;
}) {
  const kind = TRIGGER_KINDS.find((k) => k.kind === trigger.kind) ?? TRIGGER_KINDS[0];
  const branch = trigger.kind === 'git_branch' ? trigger.branch : 'main';
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="routine-trigger-kind">When</Label>
        <Select
          value={trigger.kind}
          onValueChange={(value) =>
            onChange(makeTrigger(value as TriggerKind, triggerPath(trigger), branch))
          }
        >
          <SelectTrigger id="routine-trigger-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_KINDS.map((option) => (
              <SelectItem key={option.kind} value={option.kind}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="routine-trigger-path">{kind.pathLabel}</Label>
        <Input
          id="routine-trigger-path"
          value={triggerPath(trigger)}
          placeholder="/path/on/the/backend/machine"
          onChange={(e) => onChange(makeTrigger(trigger.kind, e.target.value, branch))}
        />
      </div>
      {trigger.kind === 'git_branch' && (
        <div className="space-y-1">
          <Label htmlFor="routine-trigger-branch">Branch</Label>
          <Input
            id="routine-trigger-branch"
            value={trigger.branch}
            placeholder="main or origin/main"
            onChange={(e) => onChange({ ...trigger, branch: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
