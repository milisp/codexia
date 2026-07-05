import { useCallback, useEffect, useRef, useState } from 'react';

// Distance (px) from the bottom within which we still consider the view "at bottom"
const BOTTOM_THRESHOLD_PX = 80;

interface UseScrollToBottomOptions {
  // Selector used to locate the scrollable viewport within scrollAreaRootRef's subtree
  viewportSelector?: string;
}

interface UseScrollToBottomResult {
  // Attach to the ScrollArea root (or any wrapper containing the scrollable viewport)
  scrollAreaRootRef: React.RefObject<HTMLDivElement | null>;
  // Attach to a sentinel element placed at the very end of the scrollable content
  bottomAnchorRef: React.RefObject<HTMLDivElement | null>;
  // Whether the viewport is currently scrolled to (near) the bottom
  isAtBottom: boolean;
  // Imperatively scroll to the bottom anchor
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

// Encapsulates "stick to bottom" scroll behavior for a Radix ScrollArea (or similar)
// viewport: auto-scrolls on new content only while the user is already near the bottom,
// and exposes isAtBottom so callers can render a "jump to bottom" affordance otherwise.
export function useScrollToBottom<T>(
  dependencyList: T,
  { viewportSelector = '[data-slot="scroll-area-viewport"]' }: UseScrollToBottomOptions = {},
): UseScrollToBottomResult {
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Locate the scrollable viewport element once mounted
  useEffect(() => {
    const viewport = scrollAreaRootRef.current?.querySelector<HTMLDivElement>(viewportSelector);
    viewportRef.current = viewport ?? null;
  }, [viewportSelector]);

  const checkIsAtBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return true;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return distanceFromBottom <= BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomAnchorRef.current?.scrollIntoView({ block: 'end', behavior });
  }, []);

  // Track user scroll position so we don't force-scroll while they're reading up
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => setIsAtBottom(checkIsAtBottom());
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [checkIsAtBottom]);

  // Auto-scroll to bottom on new content, but only if the user is already near the bottom
  useEffect(() => {
    if (checkIsAtBottom()) {
      scrollToBottom('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyList, checkIsAtBottom, scrollToBottom]);

  return { scrollAreaRootRef, bottomAnchorRef, isAtBottom, scrollToBottom };
}
