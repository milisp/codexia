import type { Bot, BotTrustLevel } from '@/services/apiAdapt/bots';

/** How much a bot may do on its own, in keke's own vocabulary. */
const TRUST: Record<BotTrustLevel, { approvalPolicy: string; sandboxMode: string }> = {
  read_only: { approvalPolicy: 'on-request', sandboxMode: 'read_only' },
  ask: { approvalPolicy: 'on-request', sandboxMode: 'workspace_write' },
  autonomous: { approvalPolicy: 'never', sandboxMode: 'workspace_write' },
};

export function trustFor(bot: Bot) {
  return TRUST[bot.trustLevel] ?? TRUST.ask;
}

export const TRUST_LEVELS: Array<{ id: BotTrustLevel; label: string; description: string }> = [
  {
    id: 'read_only',
    label: 'Read-only',
    description: 'Reads and answers. Cannot change files.',
  },
  { id: 'ask', label: 'Ask before writing', description: 'Asks before anything that writes.' },
  {
    id: 'autonomous',
    label: 'Autonomous',
    description: 'Works unattended in its own workspace.',
  },
];
