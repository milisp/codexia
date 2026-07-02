import { ChevronDown, CloudUpload, GitCommit } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { gitCommit, gitPush } from '@/services/tauri/git';
import { useGitStatsStore } from '@/stores/useGitStatsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export function GitActions() {
  const { cwd } = useWorkspaceStore();
  const { refreshStats } = useGitStatsStore();
  const { toast } = useToast();

  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [activeAction, setActiveAction] = useState<'commit' | 'push'>('commit');

  const refreshGitStats = useCallback(() => {
    const currentCwd = cwd;
    if (!currentCwd) return;
    void refreshStats(currentCwd);
  }, [cwd, refreshStats]);

  const handleGitCommit = async () => {
    if (!cwd) return;
    setIsCommitDialogOpen(true);
  };

  const confirmGitCommit = async () => {
    if (!cwd) return;
    try {
      await gitCommit(cwd, commitMessage);
      refreshGitStats();
      setIsCommitDialogOpen(false);
      toast.success('Commit successful', {
        description: `Successfully committed with message: "${commitMessage}"`,
      });
    } catch (err) {
      console.error('Commit failed:', err);
      toast.error('Commit failed', {
        description: String(err),
      });
    }
  };

  const handleGitPush = async () => {
    if (!cwd) return;
    try {
      await gitPush(cwd);
      toast.success('Push successful', {
        description: 'Successfully pushed to remote',
      });
    } catch (err) {
      console.error('Push failed:', err);
      toast.error('Push failed', {
        description: String(err),
      });
    }
  };

  if (!cwd) return null;

  return (
    <>
      <div className="flex items-center border border-border rounded-lg bg-muted/20 overflow-hidden transition-all hover:bg-muted/30 hover:border-border/80 shadow-sm backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 flex items-center gap-2 rounded-none border-r border-border/50 hover:bg-accent/50"
          onClick={activeAction === 'commit' ? handleGitCommit : handleGitPush}
        >
          {activeAction === 'commit' ? (
            <GitCommit className="size-4 text-primary" />
          ) : (
            <CloudUpload className="size-4 text-primary" />
          )}
          <span className="hidden md:inline text-xs font-semibold capitalize tracking-tight">
            {activeAction}
          </span>
        </Button>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-7 rounded-none focus-visible:ring-0 hover:bg-accent/50"
              title="Switch Git Action"
            >
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-40 p-1 bg-popover/95 backdrop-blur-md border-border rounded-xl shadow-2xl"
            align="end"
          >
            <div className="p-2 text-sm">Git actions</div>
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                className="w-full justify-start text-xs h-9 gap-2.5 rounded-lg px-2.5 transition-colors"
                onClick={() => {
                  setActiveAction('commit');
                  setIsPopoverOpen(false);
                }}
              >
                <GitCommit className="size-4 text-primary" />
                <span className="font-medium">Commit</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-xs h-9 gap-2.5 rounded-lg px-2.5 transition-colors"
                onClick={() => {
                  setActiveAction('push');
                  setIsPopoverOpen(false);
                }}
              >
                <CloudUpload className="size-4 text-primary" />
                <span className="font-medium">Push</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={isCommitDialogOpen} onOpenChange={setIsCommitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Git Commit</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message"
              autoFocus
              className="min-h-[100px] bg-muted/20 border-border"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void confirmGitCommit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCommitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmGitCommit}>Commit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
