import type { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Todo, TodoCategory } from '@/stores/useTodoStore';

type TodoContextMenuProps = {
  /** Every todo the menu acts on: the selection, or just the clicked row. */
  targets: Todo[];
  categories: TodoCategory[];
  isExpanded: boolean;
  onToggleDone: (done: boolean) => void;
  onPin: (pinned: boolean) => void;
  onMove: (categoryId: string | null) => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendToComposer: () => void;
  children: ReactNode;
};

export function TodoContextMenu({
  targets,
  categories,
  isExpanded,
  onToggleDone,
  onPin,
  onMove,
  onToggleExpand,
  onEdit,
  onDelete,
  onSendToComposer,
  children,
}: TodoContextMenuProps) {
  const isSingle = targets.length === 1;
  const allDone = targets.every((todo) => todo.isDone);
  const allPinned = targets.every((todo) => todo.pinnedAt != null);
  const suffix = isSingle ? '' : ` (${targets.length})`;
  const asText = () => targets.map((todo) => todo.text).join('\n');

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* The point of capturing agent output: hand it back as the next prompt. */}
        <ContextMenuItem onSelect={onSendToComposer}>Send to composer{suffix}</ContextMenuItem>

        <ContextMenuSeparator />

        {/* Copying a todo marks it done — in plux, copying is how a todo gets used up. */}
        <ContextMenuItem
          onSelect={() => {
            navigator.clipboard.writeText(asText());
            onToggleDone(true);
          }}
        >
          Copy{suffix}
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            navigator.clipboard.writeText(targets.map((todo) => `- ${todo.text}`).join('\n'));
            onToggleDone(true);
          }}
        >
          Copy as list{suffix}
          <ContextMenuShortcut>⇧⌘C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => onToggleDone(!allDone)}>
          {allDone ? 'Mark as not done' : 'Mark as done'}
          {suffix}
          <ContextMenuShortcut>Space</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onPin(!allPinned)}>
          {allPinned ? 'Unpin' : 'Pin'}
          {suffix}
        </ContextMenuItem>

        {isSingle ? (
          <>
            <ContextMenuItem onSelect={onToggleExpand}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onEdit}>Edit</ContextMenuItem>
          </>
        ) : (
          <ContextMenuSeparator />
        )}

        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {categories.length === 0 ? (
              <ContextMenuItem disabled>No categories yet</ContextMenuItem>
            ) : (
              <>
                {categories.map((category) => (
                  <ContextMenuItem
                    key={category.id}
                    disabled={targets.every((todo) => todo.categoryId === category.id)}
                    onSelect={() => onMove(category.id)}
                  >
                    {category.name}
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={targets.every((todo) => todo.categoryId === null)}
                  onSelect={() => onMove(null)}
                >
                  None
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          Delete{suffix}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
