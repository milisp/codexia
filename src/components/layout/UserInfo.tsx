import { KeyRound, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodexAuthDialog } from '@/components/codex/CodexAuthDialog';
import { useCodexStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export function UserInfo() {
  const { setView } = useLayoutStore();
  const { t } = useTranslation('sidebar');
  const hasAccount = useCodexStore((s) => s.hasAccount);
  const hasProject = useWorkspaceStore((s) => s.projects.length > 0);
  const [codexAuthOpen, setCodexAuthOpen] = useState(false);
  const hasAutoPrompted = useRef(false);

  // First-time-use prompt: once account status resolves to "no account",
  // surface the login dialog automatically instead of leaving it hidden in a menu.
  // Wait for a project to be selected first so this doesn't get buried behind
  // the first-run project-selector dialog (same overlay z-index).
  useEffect(() => {
    if (hasAccount === false && hasProject && !hasAutoPrompted.current) {
      hasAutoPrompted.current = true;
      setCodexAuthOpen(true);
    }
  }, [hasAccount, hasProject]);

  const handleOpenSettings = () => {
    setView('settings');
  };

  return (
    <div className="w-full border-t px-2 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-8">
            <User className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-60 p-1">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" className="w-full justify-start" onClick={handleOpenSettings}>
              {t('settings')}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => setCodexAuthOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              ChatGPT Login
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <CodexAuthDialog open={codexAuthOpen} onOpenChange={setCodexAuthOpen} />
    </div>
  );
}
