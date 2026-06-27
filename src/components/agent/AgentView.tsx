import { lazy, Suspense } from 'react';
import { useAgentCenterStore } from '@/stores';
import { useLayoutStore } from '@/stores';
import { useCodexStore, useApprovalStore, useRequestUserInputStore } from '@/components/codex/stores';
import { useCCStore } from '@/stores/cc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { codexService } from '@/services/codexService';
import { ArrowLeft, X, Maximize2 } from 'lucide-react';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { AgentIcon } from '@/components/common/AgentIcon';
import { AgentComposer } from '@/components/agent';
import { CodexAgentCard } from './codex-agent-card';
import { CCAgentCard } from './cc-agent-card';

const CodexThread = lazy(() =>
  import('@/components/codex/CodexThread').then((m) => ({
    default: m.CodexThread,
  }))
);
const CCSession = lazy(() => import('@/components/cc/CCSession'));

// AgentCardHeader

type AgentStatus = 'running' | 'pending' | 'idle';

interface AgentCardHeaderProps {
  card: AgentCenterCard;
  onClose?: () => void;
  onBack?: () => void;
  onSelect?: () => void;
  onExpand?: () => void;
  status?: AgentStatus;
}

export function AgentCardHeader({
  card,
  onClose,
  onBack,
  onSelect,
  onExpand,
  status = 'idle',
}: AgentCardHeaderProps) {
  const title = card.preview?.slice(0, 60) || card.id.slice(0, 12);

  const dotColor =
    status === 'running'
      ? 'bg-green-500'
      : status === 'pending'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/40';

  const dotAnimate = status !== 'idle' ? 'animate-pulse' : '';

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/30 shrink-0"
      onClick={onSelect}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    >
      {onBack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      )}
      {onClose && (
        // Shows a status dot by default; reveals the X button on hover.
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="group relative h-3.5 w-3.5 flex items-center justify-center shrink-0"
          aria-label="Remove"
        >
          <span
            className={`absolute h-2 w-2 rounded-full transition-opacity duration-150 group-hover:opacity-0 ${dotColor} ${dotAnimate}`}
          />
          <X className="h-3.5 w-3.5 text-destructive/60 hover:text-destructive absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        </button>
      )}
      <AgentIcon agent={card.kind} />
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{title}</span>
      {onExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Expand"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export interface AgentCardProps {
  card: AgentCenterCard;
  onExpand: () => void;
  onRemove: () => void;
  isSelected: boolean;
}

export function AgentCard({ card, onExpand, onRemove, isSelected }: AgentCardProps) {
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
        (m) => m.type === 'permission_request' && !(m as any).resolved
      ) ||
      pendingApprovals.some((a) => (a as any).threadId === card.id) ||
      pendingRequests.some((r) => r.threadId === card.id);

  const status: AgentStatus = running ? 'running' : pending ? 'pending' : 'idle';

  const header = (
    <AgentCardHeader
      card={card}
      onClose={onRemove}
      onSelect={() => {
        setCurrentAgentCardId(card.id);
        if (card.kind === 'codex') void codexService.setCurrentThread(card.id);
      }}
      onExpand={onExpand}
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

function AgentFullscreen() {
  const { cards, currentAgentCardId } = useAgentCenterStore();
  const { setIsAgentExpanded } = useLayoutStore();
  const { selectedAgent } = useWorkspaceStore();

  const card = cards.find((c) => c.id === currentAgentCardId);
  // Fallback for new thread/session (no card yet): show blank header with correct agent kind
  const headerCard: AgentCenterCard = card ?? { kind: selectedAgent, id: '' };

  return (
    <div className="flex flex-col h-full min-h-0">
      <AgentCardHeader card={headerCard} onBack={() => setIsAgentExpanded(false)} />
      <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <Suspense fallback={null}>
          {selectedAgent === 'codex' ? <CodexThread /> : <CCSession />}
        </Suspense>
      </div>
    </div>
  );
}

// ─── AgentList ────────────────────────────────────────────────────────────────

function AgentList() {
  const { selectedAgent } = useWorkspaceStore();
  const currentThreadId = useCodexStore((s) => s.currentThreadId);
  const activeSessionId = useCCStore((s) => s.activeSessionId);

  // When no active thread/session, center the composer vertically
  const noActiveSession =
    selectedAgent === 'codex' ? !currentThreadId : !activeSessionId;

  if (noActiveSession) {
    return (
      <div className="flex flex-row h-full min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden items-center justify-center">
          <div className="w-full px-2 md:max-w-3xl md:px-0">
            <AgentComposer />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row h-full min-h-0 overflow-hidden">
      {/* Left: current session */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={null}>
            {selectedAgent === 'codex' ? <CodexThread hideComposer /> : <CCSession hideComposer />}
          </Suspense>
        </div>
        <div className="shrink-0 flex justify-center">
          <div className="w-full px-2 md:max-w-3xl md:px-0">
            <AgentComposer />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentView() {
  const { isAgentExpanded } = useLayoutStore();
  return isAgentExpanded ? <AgentFullscreen /> : <AgentList />;
}
