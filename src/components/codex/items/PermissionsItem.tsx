import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

function permissionLines(request: PermissionsRequest, networkLabel: string): string[] {
  const lines: string[] = [];
  const { network, fileSystem } = request.permissions;

  if (network?.enabled) {
    lines.push(networkLabel);
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
  const { t } = useTranslation('thread');

  const request = useMemo<PermissionsRequest | null>(
    () => pendingRequests.find((pending) => pending.threadId === currentThreadId) ?? null,
    [pendingRequests, currentThreadId]
  );

  if (!request) {
    return null;
  }

  const lines = permissionLines(request, t('permissions.networkAccess'));

  const decide = (decision: PermissionsDecision) => {
    setSubmitting(true);
    void respond(request, decision).finally(() => setSubmitting(false));
  };

  return (
    <div className="rounded-md border bg-background p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">permissions</Badge>
        <span className="font-medium">{t('permissions.title')}</span>
        {pendingRequests.length > 1 && (
          <Badge variant="secondary">
            {t('common.pending', { count: pendingRequests.length })}
          </Badge>
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
          {t('permissions.allowTurn')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting}
          onClick={() => decide({ kind: 'grantSession' })}
        >
          {t('permissions.allowSession')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting}
          title={t('permissions.allowStrictHint')}
          onClick={() => decide({ kind: 'grantTurnStrict' })}
        >
          {t('permissions.allowStrict')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={submitting}
          onClick={() => decide({ kind: 'deny' })}
        >
          {t('permissions.deny')}
        </Button>
      </div>
    </div>
  );
}
