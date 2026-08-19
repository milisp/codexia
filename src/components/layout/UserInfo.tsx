import { CheckCircle2, KeyRound, Plus, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import OpenAIIcon from '@/assets/openai.svg';
import type { Account } from '@/bindings/v2';
import { CodexAuthDialog } from '@/components/codex/CodexAuthDialog';
import { useCodexStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  type AccountSnapshotSummary,
  listAccountSnapshots,
  switchAccountSnapshot,
} from '@/services';
import { useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

function accountLabel(account: Account | null): string | null {
  if (!account) return null;
  switch (account.type) {
    case 'chatgpt':
      return account.email ?? 'ChatGPT';
    case 'apiKey':
      return 'API Key';
    case 'amazonBedrock':
      return 'Amazon Bedrock';
    default:
      return null;
  }
}

export function UserInfo() {
  const { setView } = useLayoutStore();
  const { t } = useTranslation('sidebar');
  const hasAccount = useCodexStore((s) => s.hasAccount);
  const account = useCodexStore((s) => s.account);
  const hasProject = useWorkspaceStore((s) => s.projects.length > 0);
  const [codexAuthOpen, setCodexAuthOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<AccountSnapshotSummary[]>([]);
  const [switchingLabel, setSwitchingLabel] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
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

  const refreshSavedAccounts = useCallback(() => {
    listAccountSnapshots()
      .then(setSavedAccounts)
      .catch(() => setSavedAccounts([]));
  }, []);

  useEffect(() => {
    if (popoverOpen) {
      refreshSavedAccounts();
    }
  }, [popoverOpen, refreshSavedAccounts]);

  // Snapshots are (re)written whenever a ChatGPT login completes; pick that
  // up so a freshly added account shows in the list without reopening.
  useEffect(() => {
    if (account?.type === 'chatgpt') {
      refreshSavedAccounts();
    }
  }, [account, refreshSavedAccounts]);

  const handleOpenSettings = () => {
    setView('settings');
    setPopoverOpen(false);
  };

  const handleSwitch = async (label: string) => {
    if (label === activeLabel) return;
    setSwitchingLabel(label);
    setSwitchError(null);
    try {
      await switchAccountSnapshot(label);
      refreshSavedAccounts();
      setPopoverOpen(false);
    } catch (error) {
      console.error('Failed to switch account:', error);
      setSwitchError(
        `${error instanceof Error ? error.message : String(error)} — sign in to this account again.`
      );
    } finally {
      setSwitchingLabel(null);
    }
  };

  const label = accountLabel(account);
  const plan = account?.type === 'chatgpt' ? account.planType : null;
  // The backend matches on auth.json's account_id; fall back to the live
  // account's email so older snapshots still get the current marker.
  const activeEmail = account?.type === 'chatgpt' ? account.email : null;
  const isCurrentAccount = (acc: AccountSnapshotSummary) =>
    acc.isCurrent || (!!activeEmail && acc.email === activeEmail);
  const activeLabel = savedAccounts.find(isCurrentAccount)?.label ?? label;

  return (
    <div className="w-full border-t px-2 py-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-8">
            <User className="h-4 w-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-64 p-1">
          <div className="flex flex-col gap-1">
            {label && (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <img src={OpenAIIcon} alt="OpenAI" className="h-6 w-6 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label}</p>
                  {plan && plan !== 'unknown' && (
                    <p className="text-xs text-muted-foreground capitalize">{plan}</p>
                  )}
                </div>
              </div>
            )}

            {savedAccounts.length > 0 && (
              <>
                <Separator className="my-1" />
                <p className="px-2 py-1 text-xs text-muted-foreground">Accounts</p>
                {savedAccounts.map((acc) => (
                  <Button
                    key={acc.label}
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    disabled={switchingLabel === acc.label}
                    onClick={() => handleSwitch(acc.label)}
                  >
                    {isCurrentAccount(acc) ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <span className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{acc.email ?? acc.label}</span>
                  </Button>
                ))}
              </>
            )}

            {switchError && <p className="px-2 py-1 text-xs text-destructive">{switchError}</p>}

            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => {
                setCodexAuthOpen(true);
                setPopoverOpen(false);
              }}
            >
              {label ? <Plus className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
              {label ? 'Add Account' : 'ChatGPT Login'}
            </Button>
            <Separator className="my-1" />
            <Button variant="ghost" className="w-full justify-start" onClick={handleOpenSettings}>
              {t('settings')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <CodexAuthDialog open={codexAuthOpen} onOpenChange={setCodexAuthOpen} />
    </div>
  );
}
