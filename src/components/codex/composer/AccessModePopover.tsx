import { AlertTriangle, Bot, Hand, ListChecks, Check } from 'lucide-react';
import type { SandboxMode } from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfigStore, useCodexStore } from '@/components/codex/stores';
import { useTranslation } from 'react-i18next';

const ACCESS_MODE_OPTIONS: Array<{
  label: string;
  sandbox: SandboxMode;
  icon: typeof Hand;
  textColor: string;
}> = [
    { label: 'askApproval', sandbox: 'read-only', icon: Hand, textColor: 'text-muted-500' },
    { label: 'approvalForMe', sandbox: 'workspace-write', icon: Bot, textColor: 'text-orange-400' },
    { label: 'fullAccess', sandbox: 'danger-full-access', icon: AlertTriangle, textColor: 'text-orange-600' },
  ];

export function AccessModePopover() {
  const { t } = useTranslation('composer')
  const { sandbox, setAccessMode, collaborationMode, setCollaborationMode } = useConfigStore();
  const { triggerInputFocus } = useCodexStore();

  const closeAndFocus = () => { triggerInputFocus(); };
  const selected =
    ACCESS_MODE_OPTIONS.find((item) => item.sandbox === sandbox) ?? ACCESS_MODE_OPTIONS[0];
  const displayLabel = collaborationMode === 'plan' ? 'plan' : selected.label;
  const DisplayIcon = collaborationMode === 'plan' ? ListChecks : selected.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`h-8 gap-2 px-2 ${selected.textColor} hover:bg-accent`}>
          <DisplayIcon className="h-4 w-4" />
          <span className="text-xs">{t(displayLabel)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="start">
        <div className="space-y-1">
          <DropdownMenuItem
            className="w-full justify-start font-normal h-8 text-xs gap-2 px-2"
            onClick={() => {
              setCollaborationMode(collaborationMode === 'plan' ? 'default' : 'plan');
              closeAndFocus();
            }}
          >
            <ListChecks className="h-3.5 w-3.5" />
            <span>{t('planMode')}</span>
          </DropdownMenuItem>
          <div className="h-px bg-border my-1" />

          {ACCESS_MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = collaborationMode !== 'plan' && option.sandbox === sandbox;

            return (
              <DropdownMenuItem
                key={option.sandbox}
                onClick={() => {
                  setAccessMode(option.sandbox);
                  setCollaborationMode('default');
                  closeAndFocus();
                }}
                className="font-normal h-8 px-2 text-xs"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex gap-2 items-center">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t(option.label)}</span>
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5" />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}