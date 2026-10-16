import { lazy, Suspense } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { useCCStore } from '@/stores/cc';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { AgentComposer } from './AgentComposer';
import { AgentPicker } from './AgentPicker';
import { AgentViewHeader } from './AgentViewHeader';

const CodexThread = lazy(() =>
  import('@/components/codex/thread/CodexThread').then((m) => ({ default: m.CodexThread }))
);
const CCSession = lazy(() => import('@/components/cc/session/CCSession'));
const AcpSession = lazy(() => import('@/components/acp/AcpSession'));

/** Renders the transcript for whichever agent drives the chat pane. */
function AgentSession() {
  const { selectedAgent } = useAgentSettingsStore();
  const acpActive = useAcpStore((s) => s.active);
  if (acpActive) return <AcpSession />;
  if (selectedAgent === 'cc') return <CCSession />;
  return <CodexThread />;
}

/** Empty state: agent picker in the middle, composer pinned at the bottom. */
function EmptySessionLayout() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto flex justify-center">
        <div className="w-full px-4 py-6 my-auto md:max-w-3xl md:px-0">
          <AgentPicker className="justify-center" />
        </div>
      </div>
      <div className="shrink-0 flex justify-center">
        <div className="w-full px-2 md:max-w-3xl md:px-0">
          <AgentComposer />
        </div>
      </div>
    </div>
  );
}

export default function AgentView() {
  const { selectedAgent } = useAgentSettingsStore();
  const { currentThreadId } = useCodexStore();
  const { activeSessionId } = useCCStore();
  const {
    active: acpActive,
    connectionId: acpConnectionId,
    sessionId: acpSessionId,
    entries: acpEntries,
  } = useAcpStore();

  // No active thread/session: show the empty state with the composer at the bottom
  // A connected ACP session with nothing said yet is still an empty chat; one
  // without a session id may be waiting on auth, which the transcript shows.
  const noActiveSession = acpActive
    ? !acpConnectionId || (Boolean(acpSessionId) && acpEntries.length === 0)
    : selectedAgent === 'codex'
      ? !currentThreadId
      : !activeSessionId;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <AgentViewHeader />
      {noActiveSession ? (
        <EmptySessionLayout />
      ) : (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Suspense fallback={null}>
              <AgentSession />
            </Suspense>
          </div>
          <div className="shrink-0 flex justify-center">
            <div className="w-full px-2 md:max-w-3xl md:px-0">
              <AgentComposer />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
