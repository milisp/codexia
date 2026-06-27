import { useEffect, useState } from 'react';
import { GitBranch, GitBranchPlus, Check, Loader2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  gitListBranches,
  gitCheckoutBranch,
  gitCreateBranch,
  gitBranchInfo,
  gitStatus,
  type GitBranchInfoResponse,
} from '@/services/tauri/git';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function BranchSwitcher({ cwd }: { cwd: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [dirtyBranch, setDirtyBranch] = useState<string | null>(null);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [newBranchSubOpen, setNewBranchSubOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCreating, setNewBranchCreating] = useState(false);
  const [newBranchError, setNewBranchError] = useState<string | null>(null);
  const [branchInfo, setBranchInfo] = useState<GitBranchInfoResponse | null>(null);

  useEffect(() => {
    if (!cwd) {
      setBranchInfo(null);
      return;
    }
    gitBranchInfo(cwd)
      .then(setBranchInfo)
      .catch(() => setBranchInfo(null));
  }, [cwd]);

  useEffect(() => {
    if (!menuOpen || !cwd) return;
    setLoading(true);
    const currentCwd = cwd;
    gitListBranches(currentCwd)
      .then((res) => setBranches(res.branches))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, [menuOpen, cwd]);

  async function doCheckoutBranch(branch: string) {
    const currentCwd = cwd;
    if (!currentCwd) return;
    setSwitching(branch);
    try {
      await gitCheckoutBranch(currentCwd, branch);
      setMenuOpen(false);
      gitBranchInfo(currentCwd)
        .then(setBranchInfo)
        .catch(() => setBranchInfo(null));
    } catch {
      // error is shown via toast from postNoContent/invokeTauri
    } finally {
      setSwitching(null);
    }
  }

  async function handleSelectBranch(branch: string) {
    const currentCwd = cwd;
    if (!currentCwd) return;
    if (branch === branchInfo?.branch || switching) return;
    try {
      const status = await gitStatus(currentCwd);
      if (status.entries.length > 0) {
        setDirtyCount(status.entries.length);
        setDirtyBranch(branch);
        return;
      }
    } catch {
      // if status check fails, proceed with checkout anyway
    }
    await doCheckoutBranch(branch);
  }

  async function handleCreateBranch() {
    const currentCwd = cwd;
    if (!currentCwd) return;
    const name = newBranchName.trim();
    if (!name || newBranchCreating) return;
    setNewBranchError(null);
    setNewBranchCreating(true);
    try {
      await gitCreateBranch(currentCwd, name);
      setBranches((prev) => [...prev, name].sort());
      setNewBranchSubOpen(false);
      setNewBranchName('');
      setMenuOpen(false);
      gitBranchInfo(currentCwd)
        .then(setBranchInfo)
        .catch(() => setBranchInfo(null));
    } catch (e) {
      setNewBranchError(String(e));
    } finally {
      setNewBranchCreating(false);
    }
  }

  const resetNewBranchForm = () => {
    setNewBranchName('');
    setNewBranchError(null);
  };

  if (!branchInfo) return null;

  return (
    <>
      <AlertDialog
        open={dirtyBranch !== null}
        onOpenChange={(open) => {
          if (!open) setDirtyBranch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Uncommitted Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {dirtyCount} uncommitted {dirtyCount === 1 ? 'change' : 'changes'}. If you
              switch to Branch{' '}
              <span className="font-mono font-semibold text-foreground">{dirtyBranch}</span>, your
              local changes will be permanently lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDirtyBranch(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const branch = dirtyBranch!;
                setDirtyBranch(null);
                doCheckoutBranch(branch);
              }}
            >
              Discard & Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) {
            setNewBranchSubOpen(false);
            resetNewBranchForm();
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-1 px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            <GitBranch className="h-3 w-3 shrink-0" />
            <span>{branchInfo.branch}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56 p-1">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="max-h-60 overflow-y-auto">
                {branches.map((branch) => {
                  const isCurrent = branch === branchInfo.branch;
                  const isSwitching = switching === branch;
                  return (
                    <DropdownMenuItem
                      key={branch}
                      disabled={!!switching}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleSelectBranch(branch);
                      }}
                      className={cn(
                        'flex justify-between items-center gap-2 px-2 py-1.5 text-xs font-mono cursor-pointer',
                        isCurrent ? 'text-foreground' : 'text-muted-foreground',
                        switching && !isSwitching && 'opacity-50'
                      )}
                    >
                      <span className="truncate">{branch}</span>
                      {isSwitching ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                      ) : isCurrent ? (
                        <Check className="h-3 w-3 shrink-0 text-primary" />
                      ) : (
                        <span className="h-3 w-3 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </div>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuSub
                open={newBranchSubOpen}
                onOpenChange={(open) => {
                  setNewBranchSubOpen(open);
                  if (!open) resetNewBranchForm();
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
                        setNewBranchError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateBranch();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setNewBranchSubOpen(false);
                        }
                      }}
                      className="h-7 text-xs font-mono"
                    />
                    {newBranchError && (
                      <p className="text-[10px] text-destructive px-1">{newBranchError}</p>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-6 flex-1 text-xs"
                        onClick={handleCreateBranch}
                        disabled={!newBranchName.trim() || newBranchCreating}
                      >
                        {newBranchCreating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Create'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => setNewBranchSubOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
