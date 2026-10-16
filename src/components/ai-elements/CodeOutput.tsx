import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockLine,
} from '@/components/ui/code-block';
import { useHighlightedCode } from '@/hooks/use-highlighted-code';
import { cn } from '@/lib/utils';

interface CodeOutputProps {
  code: string;
  /** Shiki language; `ansi` renders terminal escape sequences. */
  language?: string;
  variant?: 'default' | 'destructive';
  className?: string;
}

/** A compact, copyable code block used inside expanded trace rows. */
export function CodeOutput({ code, language = 'ansi', variant, className }: CodeOutputProps) {
  const lines = useHighlightedCode(code, language);
  return (
    <CodeBlock size="sm" variant={variant}>
      <CodeBlockActions>
        <CodeBlockCopyButton value={code} />
      </CodeBlockActions>
      <CodeBlockContent wrap className={cn('max-h-64', className)}>
        {lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are append-only and have no id
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}
