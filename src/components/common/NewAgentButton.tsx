import { useCallback, useEffect } from 'react';
import { SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useAgentCenterStore } from '@/stores';
import { useLayoutStore } from '@/stores';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { useThreadList } from '@/components/codex/hooks';
import { useTranslation } from 'react-i18next';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

type Props = {
  showLabel?: boolean;
};

export function NewAgentButton({ showLabel = false }: Props) {
  const { t } = useTranslation('sidebar')
  const { selectedAgent, cwd, setCwd } = useWorkspaceStore();
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { view, setView, setActiveSidebarTab } = useLayoutStore();
  const { handleNewSession } = useCCSessionManager();
  const { handleNewThread } = useThreadList({ enabled: false });

  const handleCreateNew = useCallback(
    async (project?: string) => {
      if (project && project !== cwd) setCwd(project);

      if (selectedAgent === 'cc') {
        setActiveSidebarTab('cc');
        setCurrentAgentCardId(null);
        setView('agent');
        await handleNewSession();
        focusCCInput();
        return;
      }
      await handleNewThread();
    },
    [cwd, handleNewSession, handleNewThread, selectedAgent, setActiveSidebarTab, setCwd, setCurrentAgentCardId, setView],
  );

  // Keyboard shortcut: Cmd/Ctrl+N → new thread / session
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(target.closest('[contenteditable="true"]'))
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isNew = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n';
      if (!isNew || e.shiftKey || e.altKey || e.repeat) return;
      if (view !== 'agent') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      void handleCreateNew();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateNew, view]);

  return (
    <Button
      onClick={() => void handleCreateNew()}
      size={showLabel ? "default" : "icon"}
      variant="ghost"
      className={`group ${showLabel ? 'justify-start' : ''} relative flex items-center gap-2`}
      title={`${t('newChat')} (⌘N)`}
    >
      <SquarePen size={16} />
      {showLabel && (
        <div className="flex items-center justify-between w-full">
          <span>{t('newChat')}</span>
          <span className="hidden group-hover:inline text-xs text-muted-foreground ml-2">
            ⌘N
          </span>
        </div>
      )}
    </Button>
  );
}

