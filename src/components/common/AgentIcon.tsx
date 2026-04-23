import { useThemeContext } from '@/contexts/ThemeContext';
import { Codex, ClaudeCode } from '@/components/icons';

type agent = 'codex' | 'cc';

export const AgentIcon = ({ agent }: { agent: agent }) => {
  const { resolvedTheme } = useThemeContext();
  if (agent === 'codex') {
    return resolvedTheme === 'dark' ? <Codex /> : <Codex />;
  } else if (agent === 'cc') {
    return resolvedTheme === 'dark' ? <ClaudeCode /> : <ClaudeCode />;
  }
};
