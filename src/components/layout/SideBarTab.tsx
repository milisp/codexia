import { ThreadList } from '@/components/codex/thread/ThreadList';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { SessionList } from '@/components/cc/session';
import { SideBarProjectList } from './SideBarProjectList';

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
  onCreateNewThread: (project: string) => void;
};

export function SideBarCodexTab({ onCreateNewThread }: SideBarCodexTabProps) {
  return (
    <SideBarProjectList
      onNewAction={onCreateNewThread}
      newActionTitle={(name) => `Start new thread in ${name}`}
      renderList={(project) => <ThreadList cwd={project} />}
    />
  );
}
