import type { McpServerConfig } from '@/components/codex/types';

export const appPresets: {
  name: string;
  label: string;
  description: string;
  access?: string;
  category?: 'finance';
  authorizationRequired?: boolean;
  config: McpServerConfig;
}[] = [
  {
    name: 'github',
    label: 'GitHub',
    description: 'Repositories, issues and pull requests',
    access: 'Authorization required',
    authorizationRequired: true,
    config: { type: 'http', url: 'https://api.githubcopilot.com/mcp/' },
  },
  {
    name: 'slack',
    label: 'Slack',
    description: 'Workspace messages and channels',
    access: 'Provider setup required',
    authorizationRequired: true,
    config: { type: 'http', url: 'https://mcp.slack.com/mcp' },
  },
  {
    name: 'linear',
    label: 'Linear',
    description: 'Issues, projects and team planning',
    access: 'Authorization required',
    authorizationRequired: true,
    config: { type: 'http', url: 'https://mcp.linear.app/mcp' },
  },
  {
    name: 'context7',
    label: 'Context7',
    description: 'Current library documentation and code examples',
    access: 'API key supported',
    config: { type: 'http', url: 'https://mcp.context7.com/mcp' },
  },
  {
    name: 'deepwiki',
    label: 'DeepWiki',
    description: 'Documentation for public GitHub repositories',
    access: 'No account required',
    config: { type: 'http', url: 'https://mcp.deepwiki.com/mcp' },
  },
  {
    name: 'you-search',
    label: 'You.com',
    description: 'Web search and page content',
    access: 'Free search endpoint',
    config: { type: 'http', url: 'https://api.you.com/mcp?profile=free' },
  },
  {
    name: 'parallel-search',
    label: 'Parallel',
    description: 'Web search and URL extraction',
    access: 'No account required',
    config: { type: 'http', url: 'https://search.parallel.ai/mcp' },
  },
  {
    name: 'fxmacrodata',
    label: 'FXMacroData',
    description: 'Macroeconomic releases, economic calendar and FX data',
    category: 'finance',
    config: { type: 'http', url: 'https://mcp.fxmacrodata.com' },
  },
];
