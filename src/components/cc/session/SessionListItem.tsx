// Single row in the SessionList, including the action dropdown menu.
import { Copy, FolderX, Loader2, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SdkSessionInfo } from '@/lib/sessions';
import { formatThreadAge } from '@/utils/formatThreadAge';

interface SessionListItemProps {
  session: SdkSessionInfo;
  isSelected: boolean;
  isActive: boolean;
  isLoading: boolean;
  onSelect: (session: SdkSessionInfo) => void;
  onCopyId: (e: React.MouseEvent, id: string) => void;
  onDeleteWorktree: (session: SdkSessionInfo) => void;
  onRequestDelete: (sessionId: string) => void;
}

export function SessionListItem({
  session,
  isSelected,
  isActive,
  isLoading,
  onSelect,
  onCopyId,
  onDeleteWorktree,
  onRequestDelete,
}: SessionListItemProps) {
  const isWorktree = (session.cwd ?? '').includes('/.codexia/worktrees/');

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative grid grid-cols-[0.5rem_1fr_auto] items-center gap-3 w-full text-left p-2 rounded-lg transition-colors cursor-pointer ${
        isSelected ? 'bg-zinc-700/50' : 'hover:bg-zinc-800/30'
      }`}
      onClick={() => onSelect(session)}
    >
      <div className="relative h-6 flex items-center justify-center">
        {isActive && isSelected && isLoading ? (
          <Loader2 className="w-3.5 h-3.5 text-green-500 animate-spin shrink-0" />
        ) : isActive ? (
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
        ) : null}
      </div>

      <div
        className={`text-sm font-medium truncate min-w-0 ${isSelected ? 'text-primary' : 'text-inherit'}`}
      >
        {session.summary}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
        <span className="group-hover:hidden">
          {formatThreadAge(Math.floor(session.last_modified / 1000))}
        </span>
      </div>

      <div className="absolute right-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded hover:bg-accent/50 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 max-md:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => onCopyId(e, session.session_id)}>
              <Copy className="h-3 w-3" />
              <span>Copy Session ID</span>
            </DropdownMenuItem>
            {isWorktree && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWorktree(session);
                }}
              >
                <FolderX className="h-3 w-3" />
                <span>Delete Worktree</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(session.session_id);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
