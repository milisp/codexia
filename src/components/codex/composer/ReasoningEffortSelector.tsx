import type { ReasoningEffort } from '@/bindings';
import type { Model } from '@/bindings/v2';
import { EffortSlider } from '@/components/common/EffortSlider';

export const GENERIC_REASONING_OPTIONS: ReasoningEffort[] = [
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
];

// Returns the reasoning effort to apply, or undefined when the current one stays valid.
export function nextReasoningEffort(
  provider: string,
  modelId: string | undefined,
  current: ReasoningEffort | undefined,
  openAiModels: Model[]
): ReasoningEffort | undefined {
  if (provider === 'openai') {
    return openAiModels.find((m) => m.id === modelId)?.defaultReasoningEffort;
  }
  return current && GENERIC_REASONING_OPTIONS.includes(current) ? undefined : 'medium';
}

type ReasoningEffortSelectorProps = {
  provider: string;
  // The selected model when the provider is openai; drives per-model options.
  openAiModel?: Model;
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
  disabled?: boolean;
};

export function ReasoningEffortSelector({
  provider,
  openAiModel,
  value,
  onChange,
  disabled = false,
}: ReasoningEffortSelectorProps) {
  const options =
    provider === 'openai'
      ? (openAiModel?.supportedReasoningEfforts.map((o) => o.reasoningEffort) ?? [])
      : GENERIC_REASONING_OPTIONS;

  return (
    <EffortSlider
      label="Reasoning Effort"
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
