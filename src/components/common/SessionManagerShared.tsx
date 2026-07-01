import { Trash2, Search, CheckSquare, Square } from 'lucide-react';
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

export interface ToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
}

export function Toolbar({
  search,
  onSearch,
  selectedCount,
  allSelected,
  onToggleAll,
  onDeleteSelected,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onToggleAll}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title={allSelected ? 'Deselect all' : 'Select all'}
      >
        {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </button>
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-8 pl-7"
        />
      </div>
      {selectedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete {selectedCount}
        </Button>
      )}
    </div>
  );
}

export interface DeleteConfirmDialogProps {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  count,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count === 1 ? '1 item' : `${count} items`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The selected {count === 1 ? 'item' : 'items'} and{' '}
            {count === 1 ? 'its' : 'their'} history will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
