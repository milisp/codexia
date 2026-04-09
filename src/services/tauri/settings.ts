import { getJson, postNoContent } from './shared';

export interface SettingsFile {
  version?: number;
  workspace?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  locale?: Record<string, unknown>;
  app?: Record<string, unknown>;
  codexConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function fetchRemoteSettings(): Promise<SettingsFile> {
  return getJson<SettingsFile>('/api/settings');
}

export async function saveRemoteSettings(settings: SettingsFile): Promise<void> {
  return postNoContent('/api/settings', settings);
}
