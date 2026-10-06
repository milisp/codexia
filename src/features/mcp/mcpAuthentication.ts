import type { KekeMcpServer } from '@/services/apiAdapt/kekeMcp';
import { appPresets } from './appPresets';

export function isGitHubMcpServer(config?: KekeMcpServer): boolean {
  if (!config?.url || (config.type !== 'http' && config.type !== 'sse')) return false;
  try {
    const url = new URL(config.url);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'api.githubcopilot.com' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443')
    );
  } catch {
    return false;
  }
}

export function mcpAuthError(error: unknown): string {
  return String(error).replace(/^(?:Error:\s*)+/, '');
}

export function needsPresetAuthorization(config: KekeMcpServer): boolean {
  if (
    config.headers &&
    Object.keys(config.headers).some((name) => name.toLowerCase() === 'authorization')
  )
    return false;
  return (
    isGitHubMcpServer(config) ||
    appPresets.some(
      (preset) =>
        preset.authorizationRequired && 'url' in preset.config && preset.config.url === config.url
    )
  );
}
