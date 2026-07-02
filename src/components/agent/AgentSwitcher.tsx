import { Button } from '@/components/ui/button';
import { useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentIcon } from '../common/AgentIcon';

const AGENT_TYPES = ['codex', 'cc'] as const;

interface AgentSwitcherProps {
  /** "icon" = icon-only ghost buttons; "tab" = icon + label tabs */
  variant?: 'icon' | 'tab';
  className?: string;
}

export function AgentSwitcher({ variant = 'icon', className }: AgentSwitcherProps) {
  const { selectedAgent, setSelectedAgent } = useWorkspaceStore();
  const { setActiveSidebarTab } = useLayoutStore();

  if (variant === 'tab') {
    return (
      <div className={`flex items-center ${className ?? ''}`}>
        {AGENT_TYPES.map((agent) => (
          <button
            type="button"
            key={agent}
            onClick={() => {
              setSelectedAgent(agent);
              setActiveSidebarTab(agent);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedAgent === agent
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <AgentIcon agent={agent} />
            <span>{agent === 'cc' ? 'Claude Code' : 'Codex'}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <span className={className}>
      {AGENT_TYPES.map((agent) => (
        <Button
          key={agent}
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${selectedAgent === agent ? 'bg-accent' : ''}`}
          onClick={() => setSelectedAgent(agent)}
        >
          <AgentIcon agent={agent} />
        </Button>
      ))}
    </span>
  );
}
