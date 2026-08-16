import { dual, dualVoid } from './shared';

export interface AppStatus {
  installed: boolean;
  path: string | null;
}

export async function checkAppInstalled(appName: string) {
  return await dual<AppStatus>(
    'check_app_installed',
    { appName },
    '/api/openapp/check-app-installed',
    { appName }
  );
}

export async function openWorkspaceIn(
  path: string,
  options: {
    appName?: string | null;
    command?: string | null;
    args?: string[];
  }
) {
  const payload = {
    app: options.appName ?? null,
    command: options.command ?? null,
    args: options.args ?? [],
  };
  await dualVoid(
    'open_workspace_in',
    { path, options: payload },
    '/api/openapp/open-workspace-in',
    { path, options: payload }
  );
}
