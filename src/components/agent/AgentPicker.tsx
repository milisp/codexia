import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AgentLogo } from './AgentLogo';
import { useAgentChoice } from './useAgentChoice';

/** Always-visible row of agents for the empty chat pane. */
export function AgentPicker({ className }: { className?: string }) {
  const { options, isCurrent, select } = useAgentChoice();

  return (
    <div role="radiogroup" aria-label="Agent" className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option, index) => {
        const selected = isCurrent(option);
        // Divide built-in agents from ACP ones (both groups can hold a "Claude").
        const firstAcp = option.kind === 'acp' && options[index - 1]?.kind === 'builtin';
        return (
          <Fragment key={`${option.kind}-${option.id}`}>
            {firstAcp && (
              <Separator
                orientation="vertical"
                className="mx-1 self-center data-[orientation=vertical]:h-6"
              />
            )}
            <Button
              role="radio"
              aria-checked={selected}
              variant="outline"
              size="sm"
              title={option.available ? option.name : `${option.name} (not installed)`}
              className={cn(
                'h-9 gap-2 rounded-full px-3',
                selected && 'border-primary bg-accent text-accent-foreground',
                !option.available && 'opacity-50'
              )}
              onClick={() => select(option)}
            >
              <AgentLogo id={option.id} />
              <span>{option.name}</span>
              {option.kind === 'acp' && option.id === 'claude' && (
                <span className="text-[10px] text-muted-foreground">ACP</span>
              )}
            </Button>
          </Fragment>
        );
      })}
    </div>
  );
}
