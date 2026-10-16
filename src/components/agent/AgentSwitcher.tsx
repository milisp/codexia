import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { AgentLogo } from './AgentLogo';
import { type AgentOption, BUILTIN_AGENTS, useAgentChoice } from './useAgentChoice';

interface AgentSwitcherProps {
  /**
   * "all" switches the chat agent, ACP agents included. "builtin" only picks
   * between Codex and Claude Agent, for screens that configure those two.
   */
  scope?: 'all' | 'builtin';
  className?: string;
}

interface AgentIconButtonsProps {
  options: AgentOption[];
  isCurrent: (option: AgentOption) => boolean;
  onSelect: (option: AgentOption) => void;
  className?: string;
}

function AgentIconButtons({ options, isCurrent, onSelect, className }: AgentIconButtonsProps) {
  return (
    <span className={cn('flex items-center gap-0.5', className)}>
      {options.map((option) => {
        const label = option.available ? option.name : `${option.name} (not installed)`;
        return (
          <Button
            key={`${option.kind}-${option.id}`}
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-pressed={isCurrent(option)}
            title={label}
            className={cn(
              'h-8 w-8',
              isCurrent(option) && 'bg-accent',
              !option.available && 'opacity-50'
            )}
            onClick={() => onSelect(option)}
          >
            <AgentLogo id={option.id} />
          </Button>
        );
      })}
    </span>
  );
}

function AllAgentsSwitcher({ className }: { className?: string }) {
  const { options, isCurrent, select } = useAgentChoice();
  return (
    <AgentIconButtons
      options={options}
      isCurrent={isCurrent}
      onSelect={select}
      className={className}
    />
  );
}

function BuiltinAgentSwitcher({ className }: { className?: string }) {
  const { selectedAgent, setSelectedAgent } = useAgentSettingsStore();
  return (
    <AgentIconButtons
      options={BUILTIN_AGENTS}
      isCurrent={(option) => option.id === selectedAgent}
      onSelect={(option) => {
        if (option.kind === 'builtin') setSelectedAgent(option.id);
      }}
      className={className}
    />
  );
}

export function AgentSwitcher({ scope = 'all', className }: AgentSwitcherProps) {
  return scope === 'builtin' ? (
    <BuiltinAgentSwitcher className={className} />
  ) : (
    <AllAgentsSwitcher className={className} />
  );
}
