import { Bot, Check } from 'lucide-react';
import { useState } from 'react';
import KekeIcon from '@/assets/keke-agent.svg';
import { AgentIcon } from '@/components/common/AgentIcon';
import { useAcpAgents } from '@/components/acp/useAcpAgents';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { acpStop } from '@/services/apiAdapt/acp';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';

export function AgentBadge() {
  const { selectedAgent, setSelectedAgent } = useAgentSettingsStore();
  const { active, agentId, connectionId, setActive, setAgentId, reset } = useAcpStore();
  const { setActiveSidebarTab } = useLayoutStore();
  const agents = useAcpAgents() ?? [];
  const acpAgent = active ? agents.find((agent) => agent.id === agentId) : undefined;
  const [open, setOpen] = useState(false);

  const selectBuiltin = (agent: 'codex' | 'cc') => {
    setSelectedAgent(agent);
    setActiveSidebarTab(agent);
    setActive(false);
    setOpen(false);
  };

  const selectAcp = async (id: string) => {
    setOpen(false);
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
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-md border border-input/60 px-2">
          {active ? (
            acpAgent?.id === 'keke' ? (
              <img src={KekeIcon} alt="" className="h-4 w-4" />
            ) : acpAgent?.id === 'claude' ? (
              <AgentIcon agent="cc" />
            ) : (
              <Bot className="h-4 w-4" />
            )
          ) : (
            <AgentIcon agent={selectedAgent} />
          )}
          <span className="max-w-28 truncate text-xs font-medium">
            {active ? (acpAgent?.name ?? agentId) : selectedAgent === 'cc' ? 'Claude Code' : 'Codex'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandList>
            <CommandGroup heading="Built-in">
              {([
                { id: 'codex', name: 'Codex' },
                { id: 'cc', name: 'Claude Code' },
              ] as const).map((agent) => (
                <CommandItem key={agent.id} value={agent.name} onSelect={() => selectBuiltin(agent.id)}>
                  <AgentIcon agent={agent.id} />
                  <span className="ml-2 flex-1">{agent.name}</span>
                  {!active && selectedAgent === agent.id && <Check className="h-3.5 w-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="ACP">
              {agents.map((agent) => (
                <CommandItem key={agent.id} value={agent.name} onSelect={() => void selectAcp(agent.id)}>
                  {agent.id === 'keke' ? <img src={KekeIcon} alt="" className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  <span className="ml-2 flex-1">{agent.name}</span>
                  {!agent.available && <span className="text-[10px] text-muted-foreground">not installed</span>}
                  {active && agentId === agent.id && <Check className="h-3.5 w-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
