import {
  acpAuthenticate,
  acpDeleteSession,
  acpNewSession,
  acpStart,
  acpStop,
} from '@/services/apiAdapt/acp';
import { captureBotOptions } from '@/stores/useBotOptionsStore';

/** The provider has no credential, and asking keke to use it would start a login flow. */
export class ProviderNotSignedInError extends Error {}

/**
 * Ask keke which models a provider serves, for a bot that has never run on it.
 *
 * keke reports models per route and only over a live connection, and the route
 * is chosen with `authenticate`, so this spawns a throwaway process, switches
 * it to `provider`, reads the new session's catalogue into the cache and shuts
 * the process down again.
 *
 * Throws `ProviderNotSignedInError` instead of authenticating when keke says
 * there is no credential: `authenticate` would open a browser login, which a
 * background lookup must not do.
 */
export async function probeProviderModels(provider: string, cwd: string) {
  const started = await acpStart('keke', cwd);
  const sessionIds = [started.sessionId];
  try {
    const method = started.initialize.authMethods?.find((m) => m.id === provider);
    if (method?._meta?.signedIn === false) throw new ProviderNotSignedInError(provider);

    await acpAuthenticate(started.connectionId, provider);
    const session = await acpNewSession(started.connectionId, cwd);
    sessionIds.push(session.sessionId);
    captureBotOptions(provider, started.initialize, session);
  } finally {
    await acpStop(started.connectionId).catch(() => {});
    // Both sessions were recorded as ordinary conversations; neither is one.
    for (const id of sessionIds) {
      if (id) await acpDeleteSession(id).catch(() => {});
    }
  }
}