import type { AcpTurnTrigger } from '@/stores/useAcpStore';

/** How a turn nobody typed is labelled: "Scheduled · Daily brief", "Asked by Scout". */
export function triggerLabel(kind: AcpTurnTrigger['kind'] | string, name?: string | null) {
  switch (kind) {
    case 'routine':
      return `Scheduled · ${name ?? 'task'}`;
    case 'bot':
      return `Asked by ${name ?? 'another bot'}`;
    default:
      return name ?? kind;
  }
}
