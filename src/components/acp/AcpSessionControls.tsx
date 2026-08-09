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
  acpSetConfigOption,
  acpSetMode,
  acpSetModel,
} from '@/services/apiAdapt/acp';
import { useAcpStore } from '@/stores/useAcpStore';

type ControlOption = { value: string; name: string; description?: string };

function ControlSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ControlOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
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
 * Model / mode / reasoning-effort controls for the live session.
 *
 * Agents expose these three ways:
 *  1. `configOptions` — the generic mechanism, already covers mode, model and
 *     thought level, so when present we render only that (Codex adapter).
 *  2. `modes` / `models` — the older per-concern fields (Gemini, Grok).
 *  3. `models[]._meta.reasoningEfforts` — Grok's per-model effort list, sent
 *     back through `_meta.reasoningEffort` on `session/set_model`.
 */
export function AcpSessionControls({ slot }: { slot: 'mode' | 'model' }) {
  const {
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
      () => acpSetConfigOption(connectionId, option.id, value)
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
    if (!modes?.availableModes.length) return null;
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
          return apply(() => setCurrentMode(previous), () => acpSetMode(connectionId, modeId));
        }}
      />
    );
  }

  const currentModel = models?.availableModels.find((m) => m.modelId === models.currentModelId);
  const efforts = currentModel?._meta?.reasoningEfforts ?? [];

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
      () => acpSetModel(connectionId, modelId, effort)
    );
  };

  return (
    <div className="flex items-center gap-1">
      {models && models.availableModels.length > 0 && (
        <ControlSelect
          label="Model"
          value={models.currentModelId}
          options={models.availableModels.map((m) => ({
            value: m.modelId,
            name: m.name,
            description: m.description,
          }))}
          onChange={(modelId) => {
            // Effort belongs to a model; carry it over only if the new model
            // offers the same level, otherwise fall back to its default.
            const next = models.availableModels.find((m) => m.modelId === modelId);
            const nextEfforts = next?._meta?.reasoningEfforts ?? [];
            const keep = nextEfforts.find((e) => e.id === reasoningEffort);
            const fallback = nextEfforts.find((e) => e.default) ?? nextEfforts[0];
            return changeModel(modelId, (keep ?? fallback)?.id ?? null);
          }}
        />
      )}

      {efforts.length > 0 && (
        <ControlSelect
          label="Effort"
          value={reasoningEffort ?? efforts.find((e) => e.default)?.id ?? efforts[0].id}
          options={efforts.map((e) => ({
            value: e.id,
            name: e.label ?? e.id,
            description: e.description,
          }))}
          onChange={(effort) => changeModel(models!.currentModelId, effort)}
        />
      )}
    </div>
  );
}
