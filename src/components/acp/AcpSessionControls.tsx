import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  type AcpConfigOption,
  acpPrompt,
  acpSetConfigOption,
  acpSetMode,
  acpSetModel,
} from '@/services/apiAdapt/acp';
import { useAcpStore } from '@/stores/useAcpStore';

type ControlOption = { value: string; name: string; description?: string };

/** Model id and reasoning effort share one select value. */
const EFFORT_SEPARATOR = '::';
const key = (modelId: string, effort: string | null) =>
  effort ? `${modelId}${EFFORT_SEPARATOR}${effort}` : modelId;

function ControlSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: ControlOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className="h-7 w-auto min-w-20 border-0 bg-transparent text-xs shadow-none gap-1"
        title={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {/* Name the control here rather than in the trigger — the toolbar is
            tight, and the label only matters while choosing. */}
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} title={o.description}>
              {o.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/**
 * Approval mode for Grok, which implements neither `session/set_mode` nor
 * `modes` on `session/new` — its only session-scoped switch is the
 * `always-approve` slash command, sent as prompt text. There is no way to read
 * the current value back, so the selection is tracked locally — keyed on the
 * session so a new one starts back on ask.
 */
function GrokApprovalSelect({
  connectionId,
  sessionId,
}: {
  connectionId: string;
  sessionId: string;
}) {
  const running = useAcpStore((s) => s.running);
  const [value, setValue] = useState('ask');

  return (
    <ControlSelect
      label="Approval"
      value={value}
      disabled={running}
      options={[
        { value: 'ask', name: 'Ask', description: 'Prompt before each tool call' },
        { value: 'yolo', name: 'Always approve', description: 'Skip all permission prompts' },
      ]}
      onChange={async (next) => {
        const previous = value;
        setValue(next);
        try {
          await acpPrompt(
            connectionId,
            sessionId,
            `/always-approve ${next === 'yolo' ? 'on' : 'off'}`
          );
        } catch (e) {
          setValue(previous);
          toast({
            title: 'Agent rejected the change',
            description: String(e),
            variant: 'destructive',
          });
        }
      }}
    />
  );
}

/**
 * Model / mode / reasoning-effort controls for the live session.
 *
 * Agents expose these three ways:
 *  1. `configOptions` — the generic mechanism, already covers mode, model and
 *     thought level, so when present we render only that (Codex adapter).
 *  2. `modes` / `models` — the older per-concern fields (Gemini, Grok).
 *  3. `models[]._meta.reasoningEfforts` — Grok's per-model effort list, folded
 *     into the model picker and sent back through `_meta.reasoningEffort` on
 *     `session/set_model`.
 *
 * Grok reports no modes at all, so its approval switch falls back to
 * {@link GrokApprovalSelect}.
 */
export function AcpSessionControls({ slot }: { slot: 'mode' | 'model' }) {
  const {
    agentId,
    connectionId,
    sessionId,
    modes,
    models,
    configOptions,
    reasoningEffort,
    setCurrentMode,
    setCurrentModel,
    setReasoningEffort,
    setConfigOptionValue,
  } = useAcpStore();

  if (!connectionId || !sessionId) return null;

  // Update optimistically, then roll back if the agent rejects the change
  // (e.g. Gemini refuses privileged modes in an untrusted folder).
  const apply = async (revert: () => void, request: () => Promise<void>) => {
    try {
      await request();
    } catch (e) {
      revert();
      toast({ title: 'Agent rejected the change', description: String(e), variant: 'destructive' });
    }
  };

  const changeConfigOption = (option: AcpConfigOption, value: string | boolean) => {
    const previous = option.currentValue;
    setConfigOptionValue(option.id, value);
    return apply(
      () => setConfigOptionValue(option.id, previous),
      () => acpSetConfigOption(connectionId, sessionId, option.id, value)
    );
  };

  if (configOptions.length) {
    // Mode sits on the left of the toolbar, model/effort on the right.
    const slotted = configOptions.filter((o) =>
      slot === 'mode' ? o.category === 'mode' : o.category !== 'mode'
    );
    if (!slotted.length) return null;
    return (
      <div className="flex items-center gap-1">
        {slotted.map((option) =>
          option.type === 'boolean' ? (
            <label
              key={option.id}
              className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground"
              title={option.description}
            >
              <span>{option.name}</span>
              <Switch
                checked={option.currentValue === true}
                onCheckedChange={(checked) => changeConfigOption(option, checked)}
              />
            </label>
          ) : (
            <ControlSelect
              key={option.id}
              label={option.name}
              value={String(option.currentValue)}
              options={option.options ?? []}
              onChange={(value) => changeConfigOption(option, value)}
            />
          )
        )}
      </div>
    );
  }

  if (slot === 'mode') {
    if (!modes?.availableModes.length) {
      return agentId === 'grok' ? (
        <GrokApprovalSelect key={sessionId} connectionId={connectionId} sessionId={sessionId} />
      ) : null;
    }
    return (
      <ControlSelect
        label="Mode"
        value={modes.currentModeId}
        options={modes.availableModes.map((m) => ({
          value: m.id,
          name: m.name,
          description: m.description,
        }))}
        onChange={(modeId) => {
          const previous = modes.currentModeId;
          setCurrentMode(modeId);
          return apply(
            () => setCurrentMode(previous),
            () => acpSetMode(connectionId, sessionId, modeId)
          );
        }}
      />
    );
  }

  const changeModel = (modelId: string, effort: string | null) => {
    const previousModel = models?.currentModelId;
    const previousEffort = reasoningEffort;
    setCurrentModel(modelId);
    setReasoningEffort(effort);
    return apply(
      () => {
        if (previousModel) setCurrentModel(previousModel);
        setReasoningEffort(previousEffort);
      },
      () => acpSetModel(connectionId, sessionId, modelId, effort)
    );
  };

  if (!models?.availableModels.length) return null;

  // Effort belongs to a model, so expand each model that offers levels into one
  // entry per level rather than pairing the picker with a second dropdown.
  const choices = models.availableModels.flatMap<ControlOption & { effort: string | null }>((m) => {
    const efforts = m._meta?.reasoningEfforts ?? [];
    if (!efforts.length) {
      return [{ value: m.modelId, name: m.name, description: m.description, effort: null }];
    }
    return efforts.map((e) => ({
      value: key(m.modelId, e.id),
      // "High Effort" reads as noise next to a model name — the level alone says it.
      name: `${m.name} · ${(e.label ?? e.id).replace(/\s*effort$/i, '')}`,
      description: e.description ?? m.description,
      effort: e.id,
    }));
  });

  // Fall back to the model's first level when the stored effort is stale.
  const current =
    choices.find((c) => c.value === key(models.currentModelId, reasoningEffort)) ??
    choices.find((c) => c.value.startsWith(models.currentModelId));

  return (
    <ControlSelect
      label="Model"
      value={current?.value ?? models.currentModelId}
      options={choices}
      onChange={(value) => {
        const choice = choices.find((c) => c.value === value);
        return changeModel(value.split(EFFORT_SEPARATOR)[0], choice?.effort ?? null);
      }}
    />
  );
}
