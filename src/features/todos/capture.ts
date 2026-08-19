import { toast } from 'sonner';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useTodoStore } from '@/stores/useTodoStore';

/**
 * Capture reads the selection straight from the DOM. It never touches the
 * system clipboard, so whatever the user already copied survives untouched.
 *
 * The hint chip and the Shift-Shift hotkey both go through here, so what the
 * hint offers and what the hotkey does can never drift apart.
 */

const isEditable = (node: Node | null | undefined): boolean => {
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || element.isContentEditable;
};

/** The current selection, if it is text a todo can be made from. */
export function getCapturableSelection(): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  // Selecting inside an editor or the composer is editing, not capturing.
  if (isEditable(selection.anchorNode) || isEditable(selection.focusNode)) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return { text, rect };
}

/** Turns text into a todo and offers an undo. Returns false if nothing was added. */
export function captureTodo(text: string): boolean {
  const id = useTodoStore.getState().addTodo(text);
  if (!id) return false;

  // The todo may have landed in a panel that is closed, which reads as
  // nothing having happened — so the toast offers the way to it.
  toast.success('Added to todos', {
    description: text.length > 80 ? `${text.slice(0, 80)}...` : text,
    action: {
      label: 'Show',
      onClick: () => showTodoPanel(),
    },
    cancel: {
      label: 'Undo',
      onClick: () => useTodoStore.getState().removeTodos([id]),
    },
  });
  return true;
}

/** Reveals the todos panel, opening the right panel if it is closed. */
export function showTodoPanel() {
  const { setActiveRightPanelTab, setRightPanelOpen } = useLayoutStore.getState();
  setActiveRightPanelTab('todo');
  setRightPanelOpen(true);
}
