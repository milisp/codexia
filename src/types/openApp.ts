export type OpenAppTarget = {
  id: string;
  label: string;
  kind: 'app' | 'command' | 'finder';
  appName?: string | null;
  command?: string | null;
  args: string[];
};
