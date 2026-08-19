import { ListPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { captureTodo, getCapturableSelection } from './capture';

type HintState = {
  text: string;
  top: number;
  left: number;
  /** Left of the selection when the gutter has room, above it otherwise. */
  placement: 'left' | 'above';
};

const CHIP_OFFSET = 8;
/** Roughly the chip's own width — below this the left gutter cannot hold it. */
const CHIP_WIDTH = 150;

/**
 * A chip that floats over a text selection offering to make a todo of it.
 *
 * The Shift-Shift hotkey is only useful to someone who knows it exists, and
 * nobody reads a shortcut list. Showing it on the selection teaches it at the
 * one moment it is wanted, and the chip stays clickable for anyone who would
 * rather not learn it at all.
 */
export function TodoCaptureHint() {
  const [hint, setHint] = useState<HintState | null>(null);

  useEffect(() => {
    // Reading the selection on mouseup rather than selectionchange keeps the
    // chip from flickering along with the caret during a drag.
    const sync = () => {
      const selection = getCapturableSelection();
      if (!selection) {
        setHint(null);
        return;
      }
      const { text, rect } = selection;
      // The gutter left of a message is empty, so the chip sits there rather
      // than over the text the user is still reading.
      const fitsLeft = rect.left > CHIP_WIDTH + CHIP_OFFSET;
      setHint({
        text,
        placement: fitsLeft ? 'left' : 'above',
        top: fitsLeft ? rect.top + rect.height / 2 : rect.top - CHIP_OFFSET,
        left: fitsLeft ? rect.left - CHIP_OFFSET : rect.left + rect.width / 2,
      });
    };

    const handleMouseDown = () => setHint(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      // The chip has said its piece once the user acts on it.
      if (event.key === 'Shift') return;
      setHint(null);
    };

    document.addEventListener('mouseup', sync);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    // The chip is anchored to viewport coordinates, so any scroll strands it.
    window.addEventListener('scroll', handleMouseDown, true);
    window.addEventListener('resize', handleMouseDown);

    return () => {
      document.removeEventListener('mouseup', sync);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleMouseDown, true);
      window.removeEventListener('resize', handleMouseDown);
    };
  }, []);

  if (!hint) return null;

  return (
    <button
      type="button"
      style={{ top: hint.top, left: hint.left }}
      className={cn(
        'fixed z-50 flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 duration-150',
        hint.placement === 'left'
          ? '-translate-x-full -translate-y-1/2'
          : '-translate-x-1/2 -translate-y-full'
      )}
      // mousedown would clear the selection before the click lands.
      onMouseDown={(event) => {
        event.preventDefault();
        captureTodo(hint.text);
        setHint(null);
      }}
    >
      <ListPlus className="size-3.5" />
      Add todo
      <kbd className="rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
        shift shift
      </kbd>
    </button>
  );
}
