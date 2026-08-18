import { AlertTriangle, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HookEventName, HookMetadata, HooksListEntry } from '@/bindings/v2';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { hooksList } from '@/services';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

interface HooksDialogProps {
  open: boolean;
  onClose: () => void;
}

const EVENT_LABELS: Record<HookEventName, string> = {
  preToolUse: 'Pre tool use',
  permissionRequest: 'Permission request',
  postToolUse: 'Post tool use',
  preCompact: 'Pre compact',
  postCompact: 'Post compact',
  sessionStart: 'Session start',
  sessionEnd: 'Session end',
  userPromptSubmit: 'User prompt submit',
  subagentStart: 'Subagent start',
  subagentStop: 'Subagent stop',
  stop: 'Stop',
};

function eventLabel(name: HookEventName): string {
  return EVENT_LABELS[name] ?? name;
}

function trustVariant(status: HookMetadata['trustStatus']) {
  if (status === 'untrusted' || status === 'modified') {
    return 'destructive' as const;
  }
  return 'secondary' as const;
}

/** Group hooks of one workspace by event name, preserving `displayOrder`. */
function groupByEvent(hooks: HookMetadata[]): Array<[HookEventName, HookMetadata[]]> {
  const groups = new Map<HookEventName, HookMetadata[]>();
  for (const hook of hooks) {
    const list = groups.get(hook.eventName);
    if (list) {
      list.push(hook);
    } else {
      groups.set(hook.eventName, [hook]);
    }
  }
  for (const list of groups.values()) {
    list.sort((a, b) => Number(a.displayOrder - b.displayOrder));
  }
  return Array.from(groups.entries());
}

function HookRow({ hook }: { hook: HookMetadata }) {
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{hook.handlerType}</Badge>
        {hook.matcher ? (
          <span className="font-mono text-muted-foreground">matcher: {hook.matcher}</span>
        ) : (
          <span className="text-muted-foreground">any matcher</span>
        )}
        {!hook.enabled && <Badge variant="secondary">disabled</Badge>}
        {hook.isManaged && <Badge variant="secondary">managed</Badge>}
        <Badge variant={trustVariant(hook.trustStatus)}>{hook.trustStatus}</Badge>
      </div>
      {hook.command && (
        <pre className="mt-1.5 overflow-x-auto rounded bg-muted p-1.5 font-mono text-[11px] whitespace-pre-wrap break-all">
          {hook.command}
        </pre>
      )}
      {hook.statusMessage && <div className="mt-1 text-muted-foreground">{hook.statusMessage}</div>}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>source: {hook.source}</span>
        {hook.pluginId && <span>plugin: {hook.pluginId}</span>}
        <span>timeout: {String(hook.timeoutSec)}s</span>
        <span className="font-mono break-all">{hook.sourcePath}</span>
      </div>
    </div>
  );
}

function HooksEntry({ entry }: { entry: HooksListEntry }) {
  const groups = groupByEvent(entry.hooks);
  return (
    <div className="space-y-3">
      <div className="font-mono text-xs text-muted-foreground break-all">{entry.cwd}</div>

      {entry.errors.map((error) => (
        <div
          key={`${error.path}:${error.message}`}
          className="flex gap-2 rounded-md border border-destructive/50 p-2 text-xs text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <div className="font-mono break-all">{error.path}</div>
            <div>{error.message}</div>
          </div>
        </div>
      ))}

      {entry.warnings.map((warning) => (
        <div
          key={warning}
          className="flex gap-2 rounded-md border p-2 text-xs text-muted-foreground"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}

      {groups.length === 0 ? (
        <div className="text-xs text-muted-foreground">No hooks configured here.</div>
      ) : (
        groups.map(([eventName, hooks]) => (
          <div key={eventName} className="space-y-1.5">
            <div className="text-sm font-medium">
              {eventLabel(eventName)}
              <span className="ml-1.5 text-xs text-muted-foreground">({hooks.length})</span>
            </div>
            {hooks.map((hook) => (
              <HookRow key={hook.key} hook={hook} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/** Read-only viewer for the lifecycle hooks configured for the current workspace. */
export function HooksDialog({ open, onClose }: HooksDialogProps) {
  const cwd = useWorkspaceStore((s) => s.cwd);
  const [entries, setEntries] = useState<HooksListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    hooksList({ cwds: cwd ? [cwd] : [] })
      .then((response) => {
        if (!cancelled) {
          setEntries(response.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, cwd]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hooks</DialogTitle>
          <DialogDescription>Lifecycle hooks configured for this workspace.</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading hooks...
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
            Failed to load hooks: {error}
          </div>
        )}

        {!loading && !error && (
          <ScrollArea className="max-h-[60vh] pr-3">
            {(entries?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No hooks configured.
              </div>
            ) : (
              <div className="space-y-5">
                {entries?.map((entry) => (
                  <HooksEntry key={entry.cwd} entry={entry} />
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
