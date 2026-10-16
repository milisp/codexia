import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';

interface ChainOfThoughtProps {
  title: string;
  running?: boolean;
  failed?: boolean;
  children: ReactNode;
}

/** A group of consecutive steps: open while work is running, one summary line when done. */
export function ChainOfThought({ title, running, failed, children }: ChainOfThoughtProps) {
  const [open, setOpen] = useState<boolean>();
  const status = running ? 'running' : failed ? 'error' : undefined;

  return (
    <Trace>
      <TraceCollapsible open={open ?? !!running} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={status}>
            <TraceIcon>
              {running ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : failed ? (
                <CircleAlertIcon />
              ) : (
                <CircleCheckIcon />
              )}
            </TraceIcon>
            <TraceTitle>{title}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>{children}</Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
