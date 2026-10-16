import { Bot } from 'lucide-react';
import { ClaudeCode, Codex, Gemini, Keke } from '@/components/icons';
import { cn } from '@/lib/utils';

interface AgentLogoProps {
  /** A built-in agent ('codex' | 'cc') or an ACP agent id. */
  id: string;
  className?: string;
}

/** Brand icon for an agent, falling back to a generic bot glyph. */
export function AgentLogo({ id, className }: AgentLogoProps) {
  const size = cn('h-4 w-4 shrink-0', className);
  if (id === 'codex') return <Codex className={size} />;
  if (id === 'cc' || id === 'claude') return <ClaudeCode className={size} />;
  if (id === 'keke') return <Keke className={size} />;
  if (id.includes('gemini')) return <Gemini className={size} />;
  return <Bot className={size} />;
}
