import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SkillGroupsConfig } from '@/services';

interface SkillGroupsBarProps {
  groupsConfig: SkillGroupsConfig;
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  onAddGroup: (name: string) => Promise<void>;
}

export function SkillGroupsBar({
  groupsConfig,
  selectedGroupId,
  onSelectGroup,
  onAddGroup,
}: SkillGroupsBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const handleSave = async () => {
    const name = newGroupName.trim();
    if (!name) {
      setDialogOpen(false);
      return;
    }
    await onAddGroup(name);
    setNewGroupName('');
    setDialogOpen(false);
  };

  const handleCancel = () => {
    setNewGroupName('');
    setDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 px-4 py-1.5 min-h-[32px]">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setDialogOpen(true)}
          title="New group"
        >
          <Plus />
        </Button>

        <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => onSelectGroup(null)}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap',
              selectedGroupId === null
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-muted text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            )}
          >
            All groups
          </button>

          {groupsConfig.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(selectedGroupId === g.id ? null : g.id)}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap',
                selectedGroupId === g.id
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-muted text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
            >
              {g.name}
              {g.skillNames.length > 0 && (
                <span className="ml-1 opacity-50">{g.skillNames.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Skill Group</DialogTitle>
          </DialogHeader>
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
