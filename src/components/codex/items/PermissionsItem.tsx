import { useMemo, useState } from 'react';
import {
  type PermissionsDecision,
  type PermissionsRequest,
  usePermissionsStore,
} from '@/components/codex/stores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type PermissionsItemProps = {
  currentThreadId: string | null;
};

function permissionLines(request: PermissionsRequest): string[] {
  const lines: string[] = [];
  const { network, fileSystem } = request.permissions;

  if (network?.enabled) {
    lines.push('Network access');
  }
  if (fileSystem) {
    for (const path of fileSystem.read ?? []) {
      lines.push(`Read ${path}`);
    }
    for (const path of fileSystem.write ?? []) {
      lines.push(`Write ${path}`);
    }
    for (const entry of fileSystem.entries ?? []) {
      lines.push(`${entry.access} ${JSON.stringify(entry.path)}`);
    }
  }
  return lines;
}

export function PermissionsItem({ currentThreadId }: PermissionsItemProps) {
  const { pendingRequests, respond } = usePermissionsStore();
  const [submitting, setSubmitting] = useState(false);

  const request = useMemo<PermissionsRequest | null>(
    () => pendingRequests.find((pending) => pending.threadId === currentThreadId) ?? null,
    [pendingRequests, currentThreadId]
  );

  if (!request) {
    return null;
  }

  const lines = permissionLines(request);

  const decide = (decision: PermissionsDecision) => {
    setSubmitting(true);
    void respond(request, decision).finally(() => setSubmitting(false));
  };

  return (
    <div className="rounded-md border bg-background p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">permissions</Badge>
        <span className="font-medium">Additional permissions requested</span>
        {pendingRequests.length > 1 && (
          <Badge variant="secondary">{pendingRequests.length} pending</Badge>
        )}
      </div>

      {request.reason && <div className="text-sm whitespace-pre-wrap">{request.reason}</div>}

      <div className="text-sm text-muted-foreground">
        <div>{request.cwd}</div>
        {lines.length > 0 && (
          <ul className="list-disc pl-5 mt-1">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={submitting} onClick={() => decide({ kind: 'grantTurn' })}>
          Allow for this turn
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting}
          onClick={() => decide({ kind: 'grantSession' })}
        >
          Allow for this session
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting}
          title="Grant for this turn, but review every subsequent command before it runs"
          onClick={() => decide({ kind: 'grantTurnStrict' })}
        >
          Allow with strict review
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={submitting}
          onClick={() => decide({ kind: 'deny' })}
        >
          Deny
        </Button>
      </div>
    </div>
  );
}
