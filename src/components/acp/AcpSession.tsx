import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { acpAuthenticate, acpNewSession, acpRespondPermission } from '@/services/apiAdapt/acp';
import { useWorkspaceStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { AcpToolCall } from './AcpToolCall';
import { useAcpEvents } from './useAcpEvents';

export default function AcpSession() {
  const {
    connectionId,
    sessionId,
    authMethods,
    entries,
    permission,
    setPermission,
    applySession,
    addEntry,
  } = useAcpStore();
  const cwd = useWorkspaceStore((s) => s.cwd);
  const bottomRef = useRef<HTMLDivElement>(null);

  useAcpEvents(connectionId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: entries.length is the trigger — scroll to the newest entry when one arrives
  // biome-ignore lint/correctness/useExhaustiveDependencies: entries.length is the trigger — scroll to the newest entry when one arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const authenticate = async (methodId: string) => {
    if (!connectionId || !cwd) return;
    try {
      await acpAuthenticate(connectionId, methodId);
      applySession(await acpNewSession(connectionId, cwd));
    } catch (e) {
      addEntry({ id: `auth-${Date.now()}`, role: 'error', text: String(e) });
    }
  };

  const respond = async (optionId: string | null) => {
    if (!connectionId || !permission) return;
    setPermission(null);
    await acpRespondPermission(connectionId, permission.requestId, optionId);
  };

  if (!connectionId) return null;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 text-sm">
        {!sessionId && authMethods.length > 0 && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              This agent needs authentication before a session can start.
            </div>
            <div className="flex flex-wrap gap-2">
              {authMethods.map((m) => (
                <Button key={m.id} size="sm" variant="outline" onClick={() => authenticate(m.id)}>
                  {m.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {entries.map((entry) => {
          if (entry.role === 'tool') {
            return <AcpToolCall key={entry.id} entry={entry} />;
          }
          const tone =
            entry.role === 'user'
              ? 'bg-muted'
              : entry.role === 'thought'
                ? 'text-muted-foreground italic'
                : entry.role === 'error'
                  ? 'text-destructive'
                  : '';
          return (
            <div key={entry.id} className={`whitespace-pre-wrap rounded-md px-2 py-1 ${tone}`}>
              {entry.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {permission && (
        <div className="shrink-0 border-t p-3 space-y-2">
          <div className="text-sm">{permission.title}</div>
          <div className="flex flex-wrap gap-2">
            {permission.options.map((o) => (
              <Button key={o.optionId} size="sm" onClick={() => respond(o.optionId)}>
                {o.name}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => respond(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
