import { useState } from 'react';
import { InputArea } from './InputArea';
import {
  ModelReasonSelector,
  AttachmentSelector,
  AccessModePopover,
} from './selector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Monitor, Split } from 'lucide-react';
import { useInputStore } from '@/stores/useInputStore';
import { useConfigStore, useCodexStore, type ThreadCwdMode } from '@/stores/codex';
import { useAgentCenterStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { codexService } from '@/services/codexService';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/utils/errorUtils';
import { WorkspaceSwitcher } from '@/components/common';

/** Full Codex bottom bar: workspace switcher + access mode + cwd mode selector. */
export function ComposerControls() {
  const { threadCwdMode, setThreadCwdMode } = useConfigStore();
  const { currentThreadId } = useCodexStore();
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="flex">
        <WorkspaceSwitcher />
      </span>
      {!currentThreadId && (
        <Select
          value={threadCwdMode}
          onValueChange={(value) => setThreadCwdMode(value as ThreadCwdMode)}
        >
          <SelectTrigger className="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">
              <span className="inline-flex items-center gap-2">
                <Monitor className="size-4" />
                <span>Local</span>
              </span>
            </SelectItem>
            <SelectItem value="worktree">
              <span className="inline-flex items-center gap-2">
                <Split className="size-4" />
                <span>Worktree</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

interface ComposerProps {
  /** When false, omits the bottom controls bar. Use when the parent pins its own bottom bar. */
  showControls?: boolean;
  /** When provided, overrides the normal send — called instead of creating a thread. */
  overrideSend?: (text: string) => void;
  onAfterSend?: (threadId: string, text: string) => void;
}

export function Composer({ showControls = true, overrideSend, onAfterSend }: ComposerProps) {
  const [images, setImages] = useState<string[]>([]);
  const { appendFileLinks } = useInputStore();
  const { currentThreadId, currentTurnId } = useCodexStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();

  const handleSend = async (message: string) => {
    if (overrideSend) {
      overrideSend(message);
      return;
    }
    let targetThreadId = currentThreadId;
    let worktreePath: string | undefined;
    if (!targetThreadId) {
      try {
        const thread = await codexService.threadStart();
        targetThreadId = thread.id;
        worktreePath = thread.cwd?.includes('/.codexia/worktrees/') ? thread.cwd : undefined;
      } catch (error) {
        console.error('Failed to start thread:', error);
        toast.error('Failed to start thread', {
          description: getErrorMessage(error),
        });
        return;
      }
    }
    const { cwd: composerCwd } = useWorkspaceStore.getState();
    addAgentCard({ kind: 'codex', id: targetThreadId, preview: message, worktreePath, cwd: composerCwd });
    setCurrentAgentCardId(targetThreadId);
    onAfterSend?.(targetThreadId, message);
    try {
      await codexService.turnStart(targetThreadId, message, images);
      setImages([]);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message', {
        description: getErrorMessage(error),
      });
    }
  };

  const handleStop = async () => {
    if (!currentThreadId || !currentTurnId) return;
    await codexService.turnInterrupt(currentThreadId, currentTurnId);
  };

  return (
    <div>
      <InputArea
        images={images}
        onRemoveImage={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
        onSend={handleSend}
        onStop={handleStop}
      >
        <AttachmentSelector
          onImagesSelected={(paths) => setImages((prev) => [...prev, ...paths])}
          onFilesSelected={(paths) => appendFileLinks(paths)}
        />
        <AccessModePopover />
        <ModelReasonSelector />
      </InputArea>

      {showControls && <ComposerControls />}
    </div>
  );
}
