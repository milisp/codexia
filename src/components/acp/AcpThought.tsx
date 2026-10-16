import { Brain, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * An `agent_thought_chunk` run: the agent working, not talking. Collapsed to a
 * small "Thinking" marker so the conversation reads as a conversation; the
 * reasoning is one click away.
 */
export function AcpThought({ text, live = false }: { text: string; live?: boolean }) {
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full px-1.5 py-0.5 select-none hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Brain className={cn('h-3 w-3', live && 'animate-pulse')} />
        {live ? 'Thinking…' : 'Thinking'}
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-1 ml-2 max-h-60 overflow-y-auto whitespace-pre-wrap border-l-2 pl-3 leading-relaxed">
        {text}
      </div>
    </details>
  );
}
