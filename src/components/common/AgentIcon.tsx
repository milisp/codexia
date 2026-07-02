import { ClaudeCode, Codex } from '@/components/icons';
import { useThemeContext } from '@/contexts/ThemeContext';

type agent = 'codex' | 'cc';

export const AgentIcon = ({ agent }: { agent: agent }) => {
  const { resolvedTheme } = useThemeContext();
  if (agent === 'codex') {
    return resolvedTheme === 'dark' ? <Codex /> : <Codex />;
  } else if (agent === 'cc') {
    return resolvedTheme === 'dark' ? <ClaudeCode /> : <ClaudeCode />;
  }
};
