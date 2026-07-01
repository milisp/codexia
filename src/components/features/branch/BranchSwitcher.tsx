import { useEffect, useState } from 'react';
import { GitBranch, Check, Loader2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  gitListBranches,
  gitCheckoutBranch,
  gitBranchInfo,
  gitStatus,
  type GitBranchInfoResponse,
} from '@/services/tauri/git';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DirtyBranchAlertDialog } from './DirtyBranchAlertDialog';
import { NewBranchSubMenu } from './NewBranchSubMenu';

export function BranchSwitcher({ cwd }: { cwd: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [dirtyBranch, setDirtyBranch] = useState<string | null>(null);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [branchInfo, setBranchInfo] = useState<GitBranchInfoResponse | null>(null);
  const [prevCwd, setPrevCwd] = useState<string | null>(null);
  const [prevMenuOpen, setPrevMenuOpen] = useState(false);

  if (cwd !== prevCwd || menuOpen !== prevMenuOpen) {
    setPrevCwd(cwd);
    setPrevMenuOpen(menuOpen);
    if (cwd !== prevCwd) {
      setBranchInfo(null);
    }
    if (menuOpen && cwd) {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!cwd) {
      return;
    }
    gitBranchInfo(cwd)
      .then(setBranchInfo)
      .catch(() => setBranchInfo(null));
  }, [cwd]);

  useEffect(() => {
    if (!menuOpen || !cwd) return;
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

  const handleBranchCreated = (name: string) => {
    setBranches((prev) => [...prev, name].sort());
    if (cwd) {
      gitBranchInfo(cwd)
        .then(setBranchInfo)
        .catch(() => setBranchInfo(null));
    }
  };

  if (!branchInfo) return null;

  return (
    <>
      <DirtyBranchAlertDialog
        isOpen={dirtyBranch !== null}
        onOpenChange={(open) => {
          if (!open) setDirtyBranch(null);
        }}
        dirtyBranch={dirtyBranch}
        dirtyCount={dirtyCount}
        onConfirm={(branch) => {
          setDirtyBranch(null);
          doCheckoutBranch(branch);
        }}
        onCancel={() => setDirtyBranch(null)}
      />

      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
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

              <NewBranchSubMenu
                cwd={cwd}
                onBranchCreated={handleBranchCreated}
                onCloseMenu={() => setMenuOpen(false)}
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
