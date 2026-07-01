import { useEffect, useRef, useState } from 'react';

/**
 * Observes the width of the referenced element and reports whether it is
 * narrower than the given threshold. Useful for hiding secondary labels
 * (e.g. provider name, mode label) in compact toolbars when space is tight.
 */
export function useNarrowContainer<T extends HTMLElement = HTMLDivElement>(threshold = 400) {
  const ref = useRef<T>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setIsNarrow(entry.contentRect.width < threshold);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isNarrow };
}
