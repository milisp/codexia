import { SquarePen } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNewThread } from '@/components/codex/hooks';
import { Button } from '@/components/ui/button';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

const focusCCInput = () => window.dispatchEvent(new Event('cc-input-focus-request'));

type Props = {
  showLabel?: boolean;
};

export function NewAgentButton({ showLabel = false }: Props) {
  const { t } = useTranslation('sidebar');
  const { selectedAgent, cwd, setCwd } = useWorkspaceStore();
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { view, setView, setActiveSidebarTab } = useLayoutStore();
  const { handleNewSession } = useCCSessionManager();
  const { handleNewThread } = useNewThread();

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
    [
      cwd,
      handleNewSession,
      handleNewThread,
      selectedAgent,
      setActiveSidebarTab,
      setCwd,
      setCurrentAgentCardId,
      setView,
    ]
  );

  // Keyboard shortcut: Cmd/Ctrl+N → new thread / session
  // NOTE: this must fire even when focus is inside the composer textarea
  // (e.g. an existing thread is open), so it intentionally does NOT skip
  // editable targets like other shortcuts do.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isNew = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n';
      if (!isNew || e.shiftKey || e.altKey || e.repeat) return;
      if (view !== 'agent') return;
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
      size={showLabel ? 'default' : 'icon'}
      variant="ghost"
      className={`group ${showLabel ? 'justify-start' : ''} relative flex items-center gap-2`}
      title={`${t('newChat')} (⌘N)`}
    >
      <SquarePen size={16} />
      {showLabel && (
        <div className="flex items-center justify-between w-full">
          <span>{t('newChat')}</span>
          <span className="hidden group-hover:inline text-xs text-muted-foreground ml-2">⌘N</span>
        </div>
      )}
    </Button>
  );
}
