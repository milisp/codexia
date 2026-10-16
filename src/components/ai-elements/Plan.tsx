import { CircleCheckIcon, CircleDotIcon, CircleIcon, RouteIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';

export interface PlanStepData {
  title: string;
  status: 'done' | 'running' | 'pending';
}

interface PlanProps {
  title: string;
  /** Progress text such as "2 of 4 done". */
  description?: string;
  steps?: PlanStepData[];
  running?: boolean;
  /** Free-form plan body shown after the steps (for example Markdown). */
  children?: ReactNode;
}

/** The agent's plan: a titled line that opens onto its steps. */
export function Plan({ title, description, steps = [], running, children }: PlanProps) {
  return (
    <Trace>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine status={running ? 'running' : undefined}>
            <TraceIcon>
              <RouteIcon />
            </TraceIcon>
            <TraceTitle>{title}</TraceTitle>
            {description && <TraceDescription>{description}</TraceDescription>}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          {steps.length > 0 && (
            <Trace>
              {steps.map((step, index) => (
                <TraceLine
                  // biome-ignore lint/suspicious/noArrayIndexKey: step titles may repeat
                  key={`${index}-${step.title}`}
                  status={
                    step.status === 'pending'
                      ? 'pending'
                      : running && step.status === 'running'
                        ? 'running'
                        : undefined
                  }
                >
                  <TraceIcon>
                    {step.status === 'done' ? (
                      <CircleCheckIcon />
                    ) : step.status === 'running' ? (
                      <CircleDotIcon />
                    ) : (
                      <CircleIcon />
                    )}
                  </TraceIcon>
                  <TraceTitle>{step.title}</TraceTitle>
                </TraceLine>
              ))}
            </Trace>
          )}
          {children}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
