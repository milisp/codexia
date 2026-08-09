import { getJsonWithOptions, invokeTauri, isDesktopTauri } from './shared';

export type TailscaleInfo = {
  dns_name: string;
  ipv4: string;
};

/** Reported by the desktop app, which can start and stop the remote server. */
export type RemoteStatus = {
  running: boolean;
  port: number;
  host: string | null;
  tailscale: TailscaleInfo | null;
  token: string | null;
};

/** Reported by the standalone server, which is already running by definition. */
type PairingInfo = {
  token: string;
  port: number;
  tailscale: TailscaleInfo | null;
};

/**
 * Reads remote-access state.
 *
 * The two runtimes answer differently: the desktop app owns a server it can
 * toggle, while the standalone `codexia-web` binary is the server, so it is
 * always running and reports itself that way.
 */
export async function remoteGetStatus(): Promise<RemoteStatus> {
  if (isDesktopTauri()) {
    return await invokeTauri<RemoteStatus>('remote_status');
  }

  const info = await getJsonWithOptions<PairingInfo>('/api/pairing', { suppressToast: true });
  return {
    running: true,
    port: info.port,
    host: info.tailscale?.ipv4 ?? null,
    tailscale: info.tailscale,
    token: info.token,
  };
}

export async function remoteStart() {
  return await invokeTauri<RemoteStatus>('remote_start');
}

export async function remoteStop() {
  return await invokeTauri<RemoteStatus>('remote_stop');
}
