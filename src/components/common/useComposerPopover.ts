import { useState, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/** Result returned by a detect function. */
export interface DetectResult {
  open: boolean;
  query: string;
}

/**
 * Detect `@query` at the end of the input (no word-boundary requirement).
 * Closes if there is a space or newline after the `@`.
 */
export function detectAtMention(input: string): DetectResult {
  const pos = input.lastIndexOf('@');
  if (pos === -1) return { open: false, query: '' };
  const after = input.slice(pos + 1);
  if (after.includes(' ') || after.includes('\n')) return { open: false, query: '' };
  return { open: true, query: after };
}

/**
 * Detect a word-boundary trigger (e.g. `/` or `$`) at the end of the input.
 * The character must be at position 0 or preceded by whitespace/newline.
 */
export function detectWordBoundaryTrigger(trigger: string) {
  return (input: string): DetectResult => {
    const pos = input.lastIndexOf(trigger);
    if (pos === -1) return { open: false, query: '' };
    const charBefore = pos > 0 ? input[pos - 1] : '';
    if (charBefore && charBefore !== ' ' && charBefore !== '\n') return { open: false, query: '' };
    const after = input.slice(pos + 1);
    if (after.includes(' ') || after.includes('\n')) return { open: false, query: '' };
    return { open: true, query: after };
  };
}

// ---------------------------------------------------------------------------
// Text replacement helper
// ---------------------------------------------------------------------------

/**
 * Replace `<trigger><query>` with `replacement` in `input`.
 * Finds the last occurrence of `trigger`, removes everything up to the next
 * whitespace/newline (the current query), and inserts `replacement` followed
 * by a space.
 *
 * Returns null if the trigger is not found.
 */
export function replaceAtTrigger(
  input: string,
  trigger: string,
  replacement: string,
): string | null {
  const pos = input.lastIndexOf(trigger);
  if (pos === -1) return null;
  const after = input.slice(pos + 1);
  const nextBreak = after.search(/[\s\n]/);
  const queryEnd = pos + 1 + (nextBreak === -1 ? after.length : nextBreak);
  return `${input.slice(0, pos)}${replacement} ${input.slice(queryEnd)}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface useComposerPopoverOptions<T> {
  /** Current editor markdown value. */
  input: string;
  /** Full (unfiltered) item list. */
  items: T[];
  /** Optional filter applied internally using the current query. */
  filter?: (item: T, query: string) => boolean;
  /** Function that inspects `input` and returns whether the popover should open and what the query is. */
  detect: (input: string) => DetectResult;
  /** Called when the user confirms a selection via keyboard (Enter/Tab). */
  onKeySelect: (item: T) => void;
}

interface useComposerPopoverReturn<T> {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  query: string;
  filteredItems: T[];
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  itemRefs: React.MutableRefObject<(HTMLElement | null)[]>;
}

/**
 * Shared logic for CC composer popovers:
 * - open/query detection from input string
 * - optional item filtering by query
 * - selectedIndex management (reset on query/open change)
 * - scroll selected item into view
 * - keyboard navigation (Arrow, Enter/Tab, Escape)
 */
export function useComposerPopover<T>({
  input,
  items,
  filter,
  detect,
  onKeySelect,
}: useComposerPopoverOptions<T>): useComposerPopoverReturn<T> {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const filteredItems = filter ? items.filter((item) => filter(item, query)) : items;

  // Run detect on every input change
  useEffect(() => {
    const result = detect(input);
    setOpen(result.open);
    setQuery(result.query);
  }, [input, detect]);

  // Reset selection when visible list changes
  useEffect(() => { setSelectedIndex(0); }, [query, open]);

  // Scroll focused item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Keyboard navigation (capture phase so it runs before the editor handles keys)
  const stableOnKeySelect = useRef(onKeySelect);
  stableOnKeySelect.current = onKeySelect;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (filteredItems.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        setSelectedIndex((p) => (p + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        setSelectedIndex((p) => (p - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault(); e.stopPropagation();
        const item = filteredItems[selectedIndex];
        if (item !== undefined) stableOnKeySelect.current(item);
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, selectedIndex, filteredItems]);

  return { open, setOpen, query, filteredItems, selectedIndex, setSelectedIndex, itemRefs };
}

// ---------------------------------------------------------------------------
// Shared select helper
// ---------------------------------------------------------------------------

/**
 * Apply a text replacement to the input store and the textarea, then focus it.
 */
export function applyEditorReplacement(
  newValue: string,
  setInput: (v: string) => void,
  editorRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  setInput(newValue);
  const ta = editorRef.current;
  if (ta) {
    ta.focus();
    requestAnimationFrame(() => {
      ta.setSelectionRange(newValue.length, newValue.length);
    });
  }
}
