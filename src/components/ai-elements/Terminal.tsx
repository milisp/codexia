import { TerminalIcon } from 'lucide-react';
import { useState } from 'react';
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';
import { CodeOutput } from './CodeOutput';
import type { ToolStatus } from './Tool';

interface TerminalProps {
  command: string;
  title: string;
  description?: string;
  status?: ToolStatus;
  output?: string | null;
}

/** A command the agent ran, with its output. Opens by itself while output streams. */
export function Terminal({ command, title, description, status, output }: TerminalProps) {
  const [open, setOpen] = useState<boolean>();
  const text = output ? `$ ${command}\n${output}` : `$ ${command}`;

  return (
    <TraceCollapsible open={open ?? (status === 'running' && !!output)} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>
        <TraceLine status={status}>
          <TraceIcon>
            <TerminalIcon />
          </TraceIcon>
          <TraceTitle>{title}</TraceTitle>
          {description && <TraceDescription>{description}</TraceDescription>}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <CodeOutput code={text} language="ansi" />
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
