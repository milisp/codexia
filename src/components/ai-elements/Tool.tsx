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

export type ToolStatus = 'running' | 'error' | 'pending';

interface ToolProps {
  icon: ReactNode;
  title: string;
  /** Short trailing text such as a duration. */
  description?: string;
  status?: ToolStatus;
  /** Expandable details. Without children the row is a plain line. */
  children?: ReactNode;
  defaultOpen?: boolean;
}

/** One tool call as a trace line, with optional expandable details. */
export function Tool({ icon, title, description, status, children, defaultOpen }: ToolProps) {
  const line = (
    <TraceLine status={status}>
      <TraceIcon>{icon}</TraceIcon>
      <TraceTitle>{title}</TraceTitle>
      {description && <TraceDescription>{description}</TraceDescription>}
    </TraceLine>
  );

  if (!children) return line;

  return (
    <TraceCollapsible defaultOpen={defaultOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>{children}</TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
