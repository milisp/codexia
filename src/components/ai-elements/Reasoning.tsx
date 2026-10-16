import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';

interface ReasoningProps {
  title: string;
  text: string;
  /** Shimmers the title while the model is still thinking. */
  running?: boolean;
  defaultOpen?: boolean;
}

/** The agent's thinking: a collapsed line whose body holds the reasoning text. */
export function Reasoning({ title, text, running, defaultOpen = false }: ReasoningProps) {
  const line = (
    <TraceLine status={running ? 'running' : undefined}>
      <TraceTitle>{title}</TraceTitle>
    </TraceLine>
  );

  if (text.trim().length === 0) return line;

  return (
    <TraceCollapsible defaultOpen={defaultOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">{text}</TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
