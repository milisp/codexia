import { lazy, Suspense } from 'react';
import { useCodexStore } from '@/components/codex/stores';
import { useCCStore } from '@/stores/cc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentComposer } from './AgentComposer';
import { AgentViewHeader } from './AgentViewHeader';

const CodexThread = lazy(() =>
  import('@/components/codex/CodexThread').then((m) => ({ default: m.CodexThread }))
);
const CCSession = lazy(() => import('@/components/cc/CCSession'));

export default function AgentView() {
  const { selectedAgent } = useWorkspaceStore();
  const { currentThreadId } = useCodexStore();
  const { activeSessionId } = useCCStore();

  // When no active thread/session, center the composer vertically
  const noActiveSession = selectedAgent === 'codex' ? !currentThreadId : !activeSessionId;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <AgentViewHeader />
      {noActiveSession ? (
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden items-center justify-center">
            <div className="w-full px-2 md:max-w-3xl md:px-0">
              <AgentComposer />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
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
      )}
    </div>
  );
}
