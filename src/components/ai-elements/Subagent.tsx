import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';

interface SubagentProps {
  title: string;
  /** Receiver ids or other short trailing text. */
  description?: string;
  state: 'running' | 'done' | 'error';
  /** Prompt and per-agent rows. Without children the row is a plain line. */
  children?: ReactNode;
}

/** Work the agent hands to a sub-agent: the run is the title, details open below. */
export function Subagent({ title, description, state, children }: SubagentProps) {
  const line = (
    <TraceLine status={state === 'running' ? 'running' : state === 'error' ? 'error' : undefined}>
      <TraceIcon>
        {state === 'done' ? (
          <CircleCheckIcon />
        ) : state === 'running' ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : (
          <CircleAlertIcon />
        )}
      </TraceIcon>
      <TraceTitle>{title}</TraceTitle>
      {description && <TraceDescription>{description}</TraceDescription>}
    </TraceLine>
  );

  if (!children) return line;

  return (
    <TraceCollapsible defaultOpen={state === 'running'}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="flex flex-col gap-2">{children}</TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
