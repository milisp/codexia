import { useEffect, useState } from 'react';
import { type AcpAgentDef, acpListAgents } from '@/services/apiAdapt/acp';

// The preset list is static for the lifetime of the app; fetch it once and
// share it between the agent picker and the composer.
let cache: AcpAgentDef[] | null = null;
let inflight: Promise<AcpAgentDef[]> | null = null;

export function useAcpAgents() {
  const [agents, setAgents] = useState<AcpAgentDef[]>(cache ?? []);

  useEffect(() => {
    if (cache) return;
    inflight ??= acpListAgents().catch(() => []);
    inflight.then((list) => {
      cache = list;
      setAgents(list);
    });
  }, []);

  return agents;
}
