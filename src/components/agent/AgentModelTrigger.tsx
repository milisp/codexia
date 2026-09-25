import { Bot, ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';
import KekeIcon from '@/assets/keke-agent.svg';
import { ClaudeCode } from '@/components/icons';
import { AgentIcon } from '@/components/common/AgentIcon';
import { useConfigStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useCCStore } from '@/stores/cc';

/**
 * Plain button trigger for `AgentModelPanel`. Deliberately has no popover of
 * its own — the panel owns the popover, so a selector like `ModelSelector`
 * or `ModelReasonSelector` can't be used directly as `trigger` (it renders
 * its own nested `Popover`, which swallows the click before the panel's
 * `PopoverTrigger asChild` ever sees it).
 *
 * Shows the current model/effort so it reads the same as the old
 * agent-specific triggers did, not just which agent is selected.
 */
export const AgentModelTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(function AgentModelTrigger(props, ref) {
  const selectedAgent = useAgentSettingsStore((s) => s.selectedAgent);
  const active = useAcpStore((s) => s.active);
  const agentId = useAcpStore((s) => s.agentId);
  const acpModels = useAcpStore((s) => s.models);
  const acpReasoningEffort = useAcpStore((s) => s.reasoningEffort);
  const acpConfigOptions = useAcpStore((s) => s.configOptions);
  const codexModel = useConfigStore((s) => s.model);
  const codexReasoningEffort = useConfigStore((s) => s.reasoningEffort);
  const ccOptions = useCCStore((s) => s.options);

  let label: string;
  let effort: string | undefined;
  let icon: React.ReactNode;

  if (active) {
    icon =
      agentId === 'keke' ? (
        <img src={KekeIcon} alt="" className="h-4 w-4" />
      ) : agentId === 'claude' ? (
        <ClaudeCode size="sm" />
      ) : (
        <Bot className="h-4 w-4" />
      );
    const modelOption = acpConfigOptions.find(
      (option) => option.category === 'model' || option.category === 'model_config'
    );
    const modelValue = modelOption?.currentValue;
    label =
      acpModels?.availableModels.find((model) => model.modelId === acpModels.currentModelId)?.name ??
      acpModels?.currentModelId ??
      (typeof modelValue === 'string'
        ? (modelOption?.options?.find((option) => option.value === modelValue)?.name ?? modelValue)
        : 'Select model');
    const effortOption = acpConfigOptions.find((option) => option.category === 'thought_level');
    const selectedEffort = effortOption?.currentValue;
    effort =
      (typeof selectedEffort === 'string'
        ? (effortOption?.options?.find((option) => option.value === selectedEffort)?.name ?? selectedEffort)
        : null) ?? acpReasoningEffort ?? undefined;
  } else if (selectedAgent === 'cc') {
    icon = <AgentIcon agent="cc" />;
    label = ccOptions.model ?? 'sonnet';
    effort = ccOptions.effort ?? 'medium';
  } else {
    icon = <AgentIcon agent="codex" />;
    label = codexModel || 'Select model';
    effort = codexReasoningEffort !== 'none' ? codexReasoningEffort : undefined;
  }

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      className="h-8 gap-2 px-2 border border-transparent transition-all hover:border-input hover:bg-accent/50"
      {...props}
    >
      {icon}
      <div className="flex items-center gap-1.5 text-xs text-foreground">
        <span className="font-medium max-w-[120px] truncate">{label}</span>
        {effort && (
          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono capitalize text-muted-foreground border">
            {effort}
          </span>
        )}
      </div>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Button>
  );
});
