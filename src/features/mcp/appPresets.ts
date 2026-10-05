import type { McpServerConfig } from '@/components/codex/types';

export const appPresets: { name: string; description: string; config: McpServerConfig }[] = [
  {
    name: 'github',
    description:
      'GitHub official remote server. Requires authorization; adding is not connecting an account.',
    config: { type: 'http', url: 'https://api.githubcopilot.com/mcp/' },
  },
  {
    name: 'slack',
    description:
      'Slack official remote server. Requires authorization and provider access; adding is not connecting an account.',
    config: { type: 'http', url: 'https://mcp.slack.com/mcp' },
  },
];
