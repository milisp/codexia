import { Bot } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import KekeIcon from '@/assets/keke-agent.svg';
import { ClaudeCode, Codex } from '@/components/icons';
import { useAcpAgents } from '@/components/acp/useAcpAgents';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { AgentIcon } from '@/components/common/AgentIcon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { AcpModelMenu } from '@/components/acp/AcpModelMenu';
import { ModelSelector as CCModelSelector } from '@/components/cc/composer/ModelSelector';
import { acpStop } from '@/services/apiAdapt/acp';
import { useLayoutStore } from '@/stores';
import { ModelReasonSelector } from '@/components/codex/composer/ModelReasonSelector';

type AgentModelPanelProps = { trigger: ReactNode };

export function AgentModelPanel({ trigger }: AgentModelPanelProps) {
  const selectedAgent = useAgentSettingsStore((s) => s.selectedAgent);
  const active = useAcpStore((s) => s.active);
  const { agentId, connectionId, setActive, setAgentId, reset } = useAcpStore();
  const { setSelectedAgent } = useAgentSettingsStore();
  const { setActiveSidebarTab } = useLayoutStore();
  const agents = useAcpAgents() ?? [];
  const [open, setOpen] = useState(false);

  const selectBuiltin = (id: 'codex' | 'cc') => {
    setSelectedAgent(id);
    setActiveSidebarTab(id);
    setActive(false);
  };

  const selectAcp = async (id: string) => {
    if (active && agentId === id) return;
    if (connectionId && agentId !== id) {
      await acpStop(connectionId);
      reset();
    }
    setAgentId(id);
    setActive(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="grid max-h-[min(70vh,640px)] min-h-0 grid-cols-[48px_minmax(0,1fr)]">
          <section className="border-r">
            <Command>
              <CommandList className="max-h-[min(70vh,640px)]">
                <CommandGroup className="p-1">
                  <CommandItem value="Codex" onSelect={() => selectBuiltin('codex')} aria-label="Codex">
                    {active ? <Codex size="sm" /> : <AgentIcon agent="codex" />}
                  </CommandItem>
                  <CommandItem value="Claude Code" onSelect={() => selectBuiltin('cc')} aria-label="Claude Code">
                    {active ? <ClaudeCode size="sm" /> : <AgentIcon agent="cc" />}
                  </CommandItem>
                </CommandGroup>
                <CommandGroup className="p-1">
                  {agents.map((agent) => (
                    <CommandItem key={agent.id} value={agent.name} onSelect={() => void selectAcp(agent.id)} aria-label={agent.name}>
                      {agent.id === 'keke' ? <img src={KekeIcon} alt="" className="h-4 w-4" /> :
                        agent.id === 'claude' ? <ClaudeCode size="sm" /> : <Bot className="h-4 w-4" />}
                    </CommandItem>
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
