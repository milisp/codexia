import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';

const NARROW_THRESHOLD = 420;

const ComposerToolbarNarrowContext = createContext(false);

/**
 * Wraps the composer's bottom toolbar row and observes its own width.
 * Descendant controls (AccessModePopover, ModelReasonSelector, etc.) read
 * `useComposerToolbarNarrow()` to hide secondary labels (mode name, provider)
 * when the toolbar is too small to fit them comfortably.
 */
export function ComposerToolbarProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setIsNarrow(entry.contentRect.width < NARROW_THRESHOLD);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      <ComposerToolbarNarrowContext.Provider value={isNarrow}>
        {children}
      </ComposerToolbarNarrowContext.Provider>
    </div>
  );
}

export function useComposerToolbarNarrow() {
  return useContext(ComposerToolbarNarrowContext);
}
