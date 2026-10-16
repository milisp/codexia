import { AcpSessionList } from '@/components/acp/AcpSessionList';
import { SessionList } from '@/components/cc/session';
import { ThreadList } from '@/components/codex/thread/ThreadList';
import { useServerProjectsStore } from '@/features/projects/useServerProjectsStore';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { SideBarProjectList } from './SideBarProjectList';
import { SideBarServerProjects } from './SideBarServerProjects';

type SideBarClaudeTabProps = {
  onStartNewSession: (directory: string) => void;
};

export function SideBarClaudeTab({ onStartNewSession }: SideBarClaudeTabProps) {
  const { handleSessionSelect } = useCCSessionManager();

  return (
    <SideBarProjectList
      onNewAction={onStartNewSession}
      newActionTitle={(name) => `Start new session in ${name}`}
      renderList={(directory) => (
        <SessionList directory={directory} onSelectSession={handleSessionSelect} />
      )}
    />
  );
}

type SideBarCodexTabProps = {
  /** Starts a thread in `project`, or outside any project for `null`. */
  onCreateNewThread: (project: string | null) => void;
};

export function SideBarCodexTab({ onCreateNewThread }: SideBarCodexTabProps) {
  const status = useServerProjectsStore((s) => s.status);
  // Without server projects (no state DB, or still loading) fall back to the
  // local cwd list so the sidebar keeps working.
  if (status === 'ready') return <SideBarServerProjects onNewChat={onCreateNewThread} />;
  return (
    <SideBarProjectList
      onNewAction={onCreateNewThread}
      newActionTitle={(name) => `Start new thread in ${name}`}
      renderList={(project) => <ThreadList cwd={project} />}
    />
  );
}

type SideBarAcpTabProps = {
  onStartNewSession: (directory: string) => void;
};

export function SideBarAcpTab({ onStartNewSession }: SideBarAcpTabProps) {
  return (
    <SideBarProjectList
      onNewAction={onStartNewSession}
      newActionTitle={(name) => `Start new ACP session in ${name}`}
      renderList={(project) => <AcpSessionList directory={project} />}
    />
  );
}
