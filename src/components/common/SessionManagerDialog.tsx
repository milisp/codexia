import { useEffect, useState } from 'react';
import { CCSessionManager } from '@/components/cc/session';
import { CodexThreadManager } from '@/components/codex/thread/CodexThreadManager';
import { AgentIcon } from '@/components/common/AgentIcon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AgentTab = 'cc' | 'codex';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: AgentTab;
}

export function SessionManagerDialog({ open, onOpenChange, defaultTab = 'cc' }: Props) {
  const [activeTab, setActiveTab] = useState<AgentTab>(defaultTab);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-2xl h-[70vh]">
        <DialogHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-0 shrink-0">
          <DialogTitle className="text-base">Session Manager</DialogTitle>
          {/* Agent tab switcher */}
          <div className="flex items-center gap-1 mr-6">
            {(['cc', 'codex'] as AgentTab[]).map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${activeTab === tab ? 'bg-accent' : ''}`}
                onClick={() => setActiveTab(tab)}
                title={tab === 'cc' ? 'Claude Code sessions' : 'Codex threads'}
              >
                <AgentIcon agent={tab} />
              </Button>
            ))}
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 px-4 pb-4 pt-3">
          {activeTab === 'cc' ? (
            <CCSessionManager open={open} onClose={() => onOpenChange(false)} />
          ) : (
            <CodexThreadManager onClose={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
