import type { CCMessage, PermissionRequestMessage } from '@/components/cc/types/messages';
import {
  useApprovalStore,
  useCodexStore,
  useRequestUserInputStore,
} from '@/components/codex/stores';
import type { ApprovalRequest } from '@/components/codex/stores/useApprovalStore';
import type { RequestUserInputRequest } from '@/components/codex/stores/useRequestUserInputStore';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore } from '@/stores';
import { useCCStore } from '@/stores/cc';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { AgentCardHeader } from './AgentCardHeader';
import { CCAgentCard } from './CcAgentCard';
import { CodexAgentCard } from './CodexAgentCard';

type AgentStatus = 'running' | 'pending' | 'idle';

export interface AgentCardProps {
  card: AgentCenterCard;
  onRemove: () => void;
  isSelected: boolean;
}

export function AgentCard({ card, onRemove, isSelected }: AgentCardProps) {
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { sessionLoadingMap, sessionMessagesMap, activeSessionIds } = useCCStore();
  const { threadStatusMap } = useCodexStore();
  const { pendingApprovals } = useApprovalStore();
  const { pendingRequests } = useRequestUserInputStore();
  const codexStatus = card.kind === 'codex' ? threadStatusMap[card.id] : undefined;
  const running =
    card.kind === 'codex'
      ? codexStatus?.type === 'active' && codexStatus.activeFlags.length === 0
      : activeSessionIds.includes(card.id) && !!sessionLoadingMap[card.id];

  const pending =
    card.kind === 'codex'
      ? codexStatus?.type === 'active' && codexStatus.activeFlags.length > 0
      : (sessionMessagesMap[card.id] ?? []).some(
        (m: CCMessage): m is PermissionRequestMessage =>
          m.type === 'permission_request' && !m.resolved
      ) ||
      pendingApprovals.some((a: ApprovalRequest) => a.threadId === card.id) ||
      pendingRequests.some((r: RequestUserInputRequest) => r.threadId === card.id);

  const status: AgentStatus = running ? 'running' : pending ? 'pending' : 'idle';

  const header = (
    <AgentCardHeader
      card={card}
      onClose={onRemove}
      onSelect={() => {
        setCurrentAgentCardId(card.id);
        if (card.kind === 'codex') {
          codexService.setCurrentThread(card.id);
        }
      }}
      status={status}
    />
  );

  if (card.kind === 'codex') {
    return (
      <CodexAgentCard
        card={card as AgentCenterCard & { kind: 'codex' }}
        onRemove={onRemove}
        header={header}
        isSelected={isSelected}
      />
    );
  }

  return (
    <CCAgentCard
      card={card as AgentCenterCard & { kind: 'cc' }}
      onRemove={onRemove}
      header={header}
      isSelected={isSelected}
    />
  );
}
