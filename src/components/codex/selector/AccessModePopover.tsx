import { AlertTriangle, Bot, ListChecks, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import type { SandboxMode } from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConfigStore, useCodexStore } from '@/components/codex/stores';


const ACCESS_MODE_OPTIONS: Array<{
  label: string;
  sandbox: SandboxMode;
  icon: typeof MessageCircle;
}> = [
    { label: 'Chat', sandbox: 'read-only', icon: MessageCircle },
    { label: 'Agent', sandbox: 'workspace-write', icon: Bot },
    { label: 'Danger', sandbox: 'danger-full-access', icon: AlertTriangle },
  ];

export function AccessModePopover() {
  const [open, setOpen] = useState(false);
  const { sandbox, setAccessMode, collaborationMode, setCollaborationMode } = useConfigStore();
  const { triggerInputFocus } = useCodexStore();

  const closeAndFocus = () => { setOpen(false); triggerInputFocus(); };
  const selected =
    ACCESS_MODE_OPTIONS.find((item) => item.sandbox === sandbox) ?? ACCESS_MODE_OPTIONS[0];

  const displayLabel = collaborationMode === 'plan' ? 'Plan Mode' : selected.label;
  const DisplayIcon = collaborationMode === 'plan' ? ListChecks : selected.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
          <DisplayIcon className="h-4 w-4" />
          <span className="text-xs">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-1">
          <Button
            variant={collaborationMode === 'plan' ? 'secondary' : 'ghost'}
            size="sm"
            className="w-full justify-start font-normal h-8 text-xs gap-2 px-2"
            onClick={() => {
              setCollaborationMode(collaborationMode === 'plan' ? 'default' : 'plan');
              closeAndFocus();
            }}
          >
            <ListChecks className="h-3.5 w-3.5" />
            <span>Plan Mode</span>
          </Button>
          <div className="h-px bg-border my-1" />

          {ACCESS_MODE_OPTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = collaborationMode !== 'plan' && item.sandbox === sandbox;

            return (
              <Button
                key={item.sandbox}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-between font-normal h-8 px-2 text-xs"
                onClick={() => {
                  setAccessMode(item.sandbox);
                  setCollaborationMode('default');
                  closeAndFocus();
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground opacity-80">{item.sandbox}</span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
