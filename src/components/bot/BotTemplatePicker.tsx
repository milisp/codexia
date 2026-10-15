import { CalendarClock, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { readKekeMcpServers } from '@/services/apiAdapt/kekeMcp';
import { useLayoutStore } from '@/stores';
import { usePluginsNavigationStore } from '@/stores/usePluginsNavigationStore';
import {
  BOT_TEMPLATES,
  type BotTemplate,
  matchingServers,
  scheduleLabel,
  TEMPLATE_GROUPS,
  type TemplateNeed,
  templateServers,
} from './botTemplates';

interface BotTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  /** `null` for a blank bot. */
  onPick: (template: BotTemplate | null, servers: string[]) => void;
}

/** How one need stands on this machine. */
function NeedChip({
  need,
  servers,
  onConnect,
}: {
  need: TemplateNeed;
  servers: string[] | null;
  onConnect: () => void;
}) {
  if (need.kind === 'folder') {
    return <span className="text-muted-foreground">Project folder</span>;
  }
  if (need.kind === 'web') {
    return (
      <span
        className="text-muted-foreground"
        title="keke's web search is turned on in keke's own config and is not checked here."
      >
        Web search in keke
      </span>
    );
  }
  const found = servers ? matchingServers(need, servers) : [];
  if (found.length > 0) {
    return <span className="text-emerald-600 dark:text-emerald-400">{need.label} ✓</span>;
  }
  return (
    <button
      type="button"
      className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
      onClick={(e) => {
        e.stopPropagation();
        onConnect();
      }}
    >
      Connect {need.label}
      {need.optional ? ' (optional)' : ''}
    </button>
  );
}

/**
 * New bot: start blank or from a role. Each role says what it needs and where
 * it stops; a missing integration links to Plugins rather than failing later.
 */
export function BotTemplatePicker({
  open,
  onOpenChange,
  creating,
  onPick,
}: BotTemplatePickerProps) {
  const [servers, setServers] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    readKekeMcpServers()
      .then((configured) => {
        if (!cancelled)
          setServers(
            Object.entries(configured)
              .filter(([, config]) => !config.disabled)
              .map(([name]) => name)
          );
      })
      .catch(() => {
        if (!cancelled) setServers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const connect = () => {
    onOpenChange(false);
    usePluginsNavigationStore.getState().openBotConnectors();
    useLayoutStore.getState().setView('plugins');
  };

  const pick = (template: BotTemplate | null) =>
    onPick(template, template ? templateServers(template, servers ?? []) : []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
        </DialogHeader>

        <Button
          variant="outline"
          className="h-auto justify-start gap-3 px-3 py-3"
          disabled={creating}
          onClick={() => pick(null)}
        >
          <Plus className="h-4 w-4" />
          <span className="text-left">
            <span className="block font-medium">Blank bot</span>
            <span className="block text-xs font-normal text-muted-foreground">
              Give it a role yourself
            </span>
          </span>
        </Button>

        {TEMPLATE_GROUPS.map((group) => (
          <section key={group} aria-label={group} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {BOT_TEMPLATES.filter((t) => t.group === group).map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm hover:bg-accent/40"
                >
                  <button
                    type="button"
                    disabled={creating}
                    aria-label={`Use ${template.name}`}
                    className="flex items-start gap-2 text-left disabled:opacity-50"
                    onClick={() => pick(template)}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: template.color }}
                      aria-hidden="true"
                    >
                      {template.avatar}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{template.name}</span>
                      <span className="block text-xs text-muted-foreground">{template.title}</span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {template.needs.map((need) => (
                      <NeedChip
                        key={need.kind === 'mcp' ? need.label : need.kind}
                        need={need}
                        servers={servers}
                        onConnect={connect}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">Stops at: {template.stopsAt}</div>
                  {template.routine && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {template.routine.name} · {scheduleLabel(template.routine.schedule)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
