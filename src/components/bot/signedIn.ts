import type { AcpAuthMethod } from '@/services/apiAdapt/acp';

/**
 * Whether keke holds a real credential for any route. A route that needs none
 * (a local server) is signed in by definition and does not count.
 */
export function hasSignedInRoute(methods: AcpAuthMethod[]) {
  return methods.some((m) => m._meta?.signedIn === true && Boolean(m._meta?.credentialSource));
}
