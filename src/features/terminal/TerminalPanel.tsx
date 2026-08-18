import { Plus, Terminal, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/stores';
import { TerminalPane } from './TerminalPane';

interface TerminalPanelProps {
  isActive: boolean;
}

export function TerminalPanel({ isActive }: TerminalPanelProps) {
  const { terminals, activeTerminalId, addTerminal, removeTerminal, setActiveTerminalId } =
    useLayoutStore();

  // Auto-open a first session the first time this tab is used.
  useEffect(() => {
    if (terminals.length === 0) addTerminal();
  }, [terminals.length, addTerminal]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-black text-zinc-100">
      <div className="flex items-center border-b border-zinc-800 bg-zinc-950 px-1 gap-0 shrink-0">
        {terminals.map((tab) => (
          <div
            key={tab.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveTerminalId(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setActiveTerminalId(tab.id);
              }
            }}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border-r border-zinc-800 transition-colors cursor-pointer select-none',
              activeTerminalId === tab.id
                ? 'bg-black text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
            )}
          >
            <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
              <Terminal
                className={cn(
                  'size-3 transition-opacity group-hover:opacity-0',
                  activeTerminalId === tab.id ? 'text-zinc-400' : 'text-zinc-500'
                )}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute inset-0 h-4 w-4 p-0 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTerminal(tab.id);
                }}
                title={`Close ${tab.label}`}
              >
                <X className="size-3" />
              </Button>
            </div>
            <span>{tab.label}</span>
          </div>
        ))}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 shrink-0"
          onClick={() => addTerminal()}
          title="New terminal"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="relative flex-1 min-h-0">
        {terminals.map((tab) => (
          <TerminalPane
            key={tab.id}
            active={isActive && tab.id === activeTerminalId}
            panelOpen={isActive}
          />
        ))}
      </div>
    </div>
  );
}
