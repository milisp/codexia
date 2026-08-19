import { ChevronDown, ChevronRight, Folder, Inbox, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import type { TodoCategory } from '@/stores/useTodoStore';
import { CategoryNameDialog } from './CategoryNameDialog';

type CategorySectionProps = {
  categories: TodoCategory[];
  todoCounts: Record<string, number>;
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
};

export function CategorySection({
  categories,
  todoCounts,
  selectedCategoryId,
  onSelect,
  onAddCategory,
  onDeleteCategory,
  onRenameCategory,
}: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<TodoCategory | null>(null);
  const [categoryToRename, setCategoryToRename] = useState<TodoCategory | null>(null);

  const rowClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors',
      active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
    );

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          className="flex items-center gap-1 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          Categories
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="New category"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded ? (
        <div className="space-y-0.5 pb-1">
          <button
            type="button"
            className={rowClass(selectedCategoryId === null)}
            onClick={() => onSelect(null)}
          >
            <Inbox className="size-3.5 shrink-0" />
            <span className="flex-1 truncate">All</span>
          </button>

          {categories.map((category) => (
            <ContextMenu key={category.id}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className={rowClass(selectedCategoryId === category.id)}
                  onClick={() => onSelect(category.id)}
                >
                  <Folder className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">{category.name}</span>
                  {todoCounts[category.id] ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {todoCounts[category.id]}
                    </span>
                  ) : null}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => setCategoryToRename(category)}>
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => setCategoryToDelete(category)}
                >
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      ) : null}

      <CategoryNameDialog
        open={addOpen}
        title="New category"
        confirmLabel="Add"
        onOpenChange={setAddOpen}
        onConfirm={onAddCategory}
      />

      <CategoryNameDialog
        open={categoryToRename !== null}
        title="Rename category"
        confirmLabel="Rename"
        initialName={categoryToRename?.name ?? ''}
        onOpenChange={(open) => {
          if (!open) setCategoryToRename(null);
        }}
        onConfirm={(name) => {
          if (categoryToRename) onRenameCategory(categoryToRename.id, name);
          setCategoryToRename(null);
        }}
      />

      <ConfirmDialog
        isOpen={categoryToDelete !== null}
        title="Delete category"
        description={`Delete "${categoryToDelete?.name ?? ''}"? Its todos are kept and become uncategorized.`}
        onConfirm={() => {
          if (categoryToDelete) onDeleteCategory(categoryToDelete.id);
          setCategoryToDelete(null);
        }}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}
