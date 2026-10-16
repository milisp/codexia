import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { AcpModelMenu } from '@/components/acp/AcpModelMenu';
import { ModelSelector as CCModelSelector } from '@/components/cc/composer/ModelSelector';
import { ModelReasonSelector } from '@/components/codex/composer/ModelReasonSelector';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { AgentLogo } from './AgentLogo';
import { useAgentChoice } from './useAgentChoice';

type AgentModelPanelProps = { trigger: ReactNode };

export function AgentModelPanel({ trigger }: AgentModelPanelProps) {
  const selectedAgent = useAgentSettingsStore((s) => s.selectedAgent);
  const active = useAcpStore((s) => s.active);
  const { options, isCurrent, select } = useAgentChoice();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="grid max-h-[min(70vh,640px)] min-h-0 grid-cols-[48px_minmax(0,1fr)]">
          <section className="border-r">
            <Command>
              <CommandList className="max-h-[min(70vh,640px)]">
                <CommandGroup className="p-1">
                  {options.map((option, index) => (
                    <Fragment key={`${option.kind}-${option.id}`}>
                      {option.kind === 'acp' && options[index - 1]?.kind === 'builtin' && (
                        <Separator className="my-1" />
                      )}
                      <CommandItem
                        value={`${option.kind}-${option.id}`}
                        onSelect={() => select(option)}
                        aria-label={option.name}
                        title={option.name}
                        className={cn(
                          'justify-center',
                          isCurrent(option) && 'bg-accent',
                          !option.available && 'opacity-50'
                        )}
                      >
                        <AgentLogo id={option.id} />
                      </CommandItem>
                    </Fragment>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </section>
          <section className="min-h-0 min-w-0 overflow-y-auto p-2">
            {active ? (
              <AcpModelMenu embedded />
            ) : selectedAgent === 'cc' ? (
              <CCModelSelector embedded />
            ) : (
              <ModelReasonSelector mode="panel" />
            )}
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
