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
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentCardHeader } from './AgentCardHeader';
import { CCAgentCard } from './CcAgentCard';
import { CodexAgentCard } from './CodexAgentCard';

type AgentStatus = 'running' | 'pending' | 'idle';

export interface AgentCardProps {
  card: AgentCenterCard;
  onRemove: () => void;
  isSelected: boolean;
  // When true, only the header is rendered (used by the list view).
  hideBody?: boolean;
}

export function AgentCard({ card, onRemove, isSelected, hideBody = false }: AgentCardProps) {
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { sessionLoadingMap, sessionMessagesMap, activeSessionIds, switchToSession } =
    useCCStore();
  const { threadStatusMap } = useCodexStore();
  const { pendingApprovals } = useApprovalStore();
  const { pendingRequests } = useRequestUserInputStore();
  const { setSelectedAgent } = useWorkspaceStore();
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
        // Switch the underlying agent/thread/session so single view renders this card's content.
        setSelectedAgent(card.kind);
        if (card.kind === 'codex') {
          codexService.setCurrentThread(card.id);
        } else {
          switchToSession(card.id);
        }
      }}
      status={status}
    />
  );

  // List view: render header only, no body/footer.
  if (hideBody) {
    const attentionBorder = isSelected ? 'ring-2 ring-primary/60 border-primary/30' : 'border';
    return <div className={`rounded-lg bg-background overflow-hidden ${attentionBorder}`}>{header}</div>;
  }

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
