import { GitBranchPlus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { gitCreateBranch } from '@/services/tauri/git';

interface NewBranchSubMenuProps {
  cwd: string | null;
  onBranchCreated: (name: string) => void;
  onCloseMenu: () => void;
}

export function NewBranchSubMenu({ cwd, onBranchCreated, onCloseMenu }: NewBranchSubMenuProps) {
  const [open, setOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setNewBranchName('');
    setError(null);
  };

  async function handleCreateBranch() {
    if (!cwd) return;
    const name = newBranchName.trim();
    if (!name || creating) return;
    setError(null);
    setCreating(true);
    try {
      await gitCreateBranch(cwd, name);
      onBranchCreated(name);
      setOpen(false);
      resetForm();
      onCloseMenu();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <DropdownMenuSub
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground cursor-pointer">
        <GitBranchPlus className="h-3 w-3 shrink-0" />
        <span>New branch</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56 p-2 ml-1">
        <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Input
            autoFocus
            placeholder="New branch name..."
            value={newBranchName}
            onChange={(e) => {
              setNewBranchName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateBranch();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="h-7 text-xs font-mono"
          />
          {error && <p className="text-[10px] text-destructive px-1">{error}</p>}
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-6 flex-1 text-xs"
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim() || creating}
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
