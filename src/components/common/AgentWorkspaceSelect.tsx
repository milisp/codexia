import { Check, ChevronDown, Monitor, Split } from 'lucide-react';
import type { ThreadCwdMode } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AgentWorkspaceSelectProps {
  value: ThreadCwdMode;
  onValueChange: (value: ThreadCwdMode) => void;
}

const MODE_ICONS: Record<ThreadCwdMode, React.ReactNode> = {
  local: <Monitor size={14} />,
  worktree: <Split size={14} />,
};

const MODE_LABELS: Record<ThreadCwdMode, string> = {
  local: 'Local',
  worktree: 'Worktree',
};

export function AgentWorkspaceSelect({ value, onValueChange }: AgentWorkspaceSelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1">
          {MODE_ICONS[value]}
          <span>{MODE_LABELS[value]}</span>
          <ChevronDown size={10} className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onValueChange('local')} className="flex justify-between">
          <span className="flex gap-2">
            <Monitor className="h-4 w-4" />
            <span>Local</span>
          </span>
          {value === 'local' && <Check />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onValueChange('worktree')}
          className="flex justify-between item-center"
        >
          <span className="flex gap-2">
            <Split className="h-4 w-4" />
            <span>Worktree</span>
          </span>
          {value === 'worktree' && <Check />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
