import type { AcpTurnTrigger } from '@/stores/useAcpStore';

/** How a turn nobody typed is labelled: "Scheduled · Daily brief", "Asked by Scout". */
export function triggerLabel(kind: AcpTurnTrigger['kind'] | string, name?: string | null) {
  switch (kind) {
    case 'routine':
      return `Scheduled · ${name ?? 'task'}`;
    case 'event':
      return `When · ${name ?? 'task'}`;
    case 'bot':
      return `Asked by ${name ?? 'another bot'}`;
    case 'draft':
      return `You approved · ${name ?? 'draft'}`;
    case 'handback':
      return `You finished · ${name ?? 'a step'}`;
    default:
      return name ?? kind;
  }
}
