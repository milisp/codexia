import { invokeTauri, isTauri } from './shared';

export interface TunnelStatus {
  connected: boolean;
  url: string | null;
}

export async function tunnelStart(jwt: string, port?: number): Promise<TunnelStatus> {
  if (!isTauri()) throw new Error('tunnel only available in desktop app');
  return invokeTauri<TunnelStatus>('tunnel_start', { jwt, port });
}

export async function tunnelStop(): Promise<void> {
  if (!isTauri()) return;
  return invokeTauri<void>('tunnel_stop');
}

export async function tunnelStatus(): Promise<TunnelStatus> {
  if (!isTauri()) return { connected: false, url: null };
  return invokeTauri<TunnelStatus>('tunnel_status_cmd');
}
