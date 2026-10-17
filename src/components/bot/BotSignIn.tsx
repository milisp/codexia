import { ChevronDown, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type AcpAuthMethod, acpAuthenticate, acpNewSession } from '@/services/apiAdapt/acp';
import type { Bot } from '@/services/apiAdapt/bots';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

const CHATGPT = 'codex';

/**
 * Shown in the composer's place when the bot's agent started but no account
 * it can use is signed in. ChatGPT is offered first; every other route keke
 * reports stays one click away.
 */
export function BotSignIn({
  bot,
  connectionId,
  methods,
}: {
  bot: Bot;
  connectionId: string;
  methods: AcpAuthMethod[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatgpt = methods.find((m) => m.id === CHATGPT);
  const others = methods.filter((m) => m.id !== CHATGPT);

  const signIn = async (methodId: string) => {
    setBusy(methodId);
    setError(null);
    try {
      await acpAuthenticate(connectionId, methodId);
      // An empty folder lets the backend pick the bot's own workspace.
      const session = await acpNewSession(connectionId, bot.cwd);
      if (useBotUiStore.getState().selectedBotId !== bot.id) return;
      const store = useAcpStore.getState();
      store.setEntries([]);
      store.applySession(session);
      if (session.sessionId) useBotUiStore.getState().setBotSession(bot.id, session.sessionId);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="shrink-0 border-t bg-background p-3">
      <div className="space-y-2 rounded-2xl border border-dashed px-3 py-3 text-sm">
        <div className="flex items-center gap-3">
          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-muted-foreground">
            Sign in to an AI account so {bot.name} can work.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {chatgpt && (
            <Button size="sm" disabled={busy !== null} onClick={() => void signIn(chatgpt.id)}>
              {busy === chatgpt.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Sign in with ChatGPT
            </Button>
          )}
          {others.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy !== null}>
                  {busy && busy !== CHATGPT && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {chatgpt ? 'Other account' : 'Choose account'}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {others.map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => void signIn(m.id)}>
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
