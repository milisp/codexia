type StdioMcpServerConfig = {
  type?: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
};

type HttpMcpServerConfig = {
  type: 'http';
  url: string;
  enabled?: boolean;
};

type SseMcpServerConfig = {
  type: 'sse';
  url: string;
  enabled?: boolean;
};

export type McpServerConfig = StdioMcpServerConfig | HttpMcpServerConfig | SseMcpServerConfig;
