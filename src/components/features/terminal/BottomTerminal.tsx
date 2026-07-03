import { Plus, Terminal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/stores';
import { TerminalPane } from './TerminalPane';

export function BottomTerminal() {
  const {
    isTerminalOpen,
    setIsTerminalOpen,
    terminals,
    activeTerminalId,
    addTerminal,
    removeTerminal,
    setActiveTerminalId,
  } = useLayoutStore();
  const isMobile = useIsMobile();

  return (
    <div
      style={{ height: isTerminalOpen ? (isMobile ? '42dvh' : '18rem') : '0px' }}
      className={cn(
        'border-t border-border/80 bg-black text-zinc-100 transition-[height,opacity] duration-200 ease-out flex flex-col min-h-0',
        isTerminalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Tab bar */}
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
            {/* Close/Icon container */}
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

        {/* New tab button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 shrink-0"
          onClick={addTerminal}
          title="New terminal"
        >
          <Plus className="size-3.5" />
        </Button>

        <div className="flex-1" />

        {/* Hide panel button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 mr-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 shrink-0"
          onClick={() => setIsTerminalOpen(false)}
          title="Close terminal panel"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Panes — all mounted, only active one visible (preserves xterm state) */}
      <div className="relative flex-1 min-h-0">
        {terminals.map((tab) => (
          <TerminalPane
            key={tab.id}
            active={tab.id === activeTerminalId}
            panelOpen={isTerminalOpen}
          />
        ))}
      </div>
    </div>
  );
}
