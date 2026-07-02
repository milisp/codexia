import { ThreadList } from '@/components/codex/ThreadList';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { ClaudeCodeSessionList } from '../cc/SessionList';
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
        <ClaudeCodeSessionList directory={directory} onSelectSession={handleSessionSelect} />
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
