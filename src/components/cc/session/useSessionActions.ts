// Handles session/worktree deletion and copy-id actions.
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import type { SdkSessionInfo } from '@/lib/sessions';
import { ccDeleteSession } from '@/services/tauri/cc';
import { gitRemoveWorktree } from '@/services/tauri/git';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

interface UseSessionActionsArgs {
  onSessionDeleted: (sessionId: string) => void;
}

export function useSessionActions({ onSessionDeleted }: UseSessionActionsArgs) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const doDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await ccDeleteSession(sessionId);
        onSessionDeleted(sessionId);
      } catch {
        toast({ description: 'Failed to delete session', variant: 'destructive' });
      }
    },
    [onSessionDeleted, toast],
  );

  const doDeleteWorktree = useCallback(
    async (session: SdkSessionInfo) => {
      const sessionProject = session.cwd ?? '';
      if (!sessionProject.includes('/.codexia/worktrees/')) return;
      const worktreeKey = sessionProject.split('/').pop() ?? '';
      const mainCwd = useWorkspaceStore.getState().cwd;
      if (!mainCwd) return;
      try {
        await gitRemoveWorktree(mainCwd, worktreeKey);
        toast({ description: 'Worktree deleted' });
      } catch {
        toast({ description: 'Failed to delete worktree', variant: 'destructive' });
      }
    },
    [toast],
  );

  const copySessionId = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(id);
      toast({ description: 'Session ID copied to clipboard' });
    },
    [toast],
  );

  return {
    pendingDeleteId,
    setPendingDeleteId,
    doDeleteSession,
    doDeleteWorktree,
    copySessionId,
  };
}
