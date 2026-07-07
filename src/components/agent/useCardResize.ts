import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';

// Default height matches the previous fixed `h-72` (72 * 4px = 288px).
const DEFAULT_HEIGHT = 288;
const MIN_WIDTH = 260;
const MAX_WIDTH = 900;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 800;

type DragAxis = 'width' | 'height' | 'both';

interface LiveSize {
  width?: number;
  height: number;
}

/**
 * Ghostty-style manual resize for a single agent card in grid view.
 * Width is undefined until the user drags the right edge (card keeps its
 * natural flex-basis until then); height defaults to the old fixed h-72.
 * Drag position is tracked in local state for a smooth 60fps feel and only
 * committed to the persisted store on pointer release.
 */
export function useCardResize(cardId: string) {
  const storedSize = useAgentCenterStore((s) => s.cardSizeMap[cardId]);
  const setCardSize = useAgentCenterStore((s) => s.setCardSize);

  const [size, setSize] = useState<LiveSize>({
    width: storedSize?.width,
    height: storedSize?.height ?? DEFAULT_HEIGHT,
  });

  // Reflect external store changes (e.g. reset elsewhere) when not actively dragging.
  useEffect(() => {
    setSize({ width: storedSize?.width, height: storedSize?.height ?? DEFAULT_HEIGHT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedSize?.width, storedSize?.height]);

  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const dragRef = useRef<{
    axis: DragAxis;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const startDrag = useCallback(
    (axis: DragAxis) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const rootEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-card-root]');
      const rect = rootEl?.getBoundingClientRect();
      dragRef.current = {
        axis,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect?.width ?? sizeRef.current.width ?? MIN_WIDTH,
        startHeight: rect?.height ?? sizeRef.current.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setSize((prev) => {
      const next = { ...prev };
      if (drag.axis === 'width' || drag.axis === 'both') {
        next.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, drag.startWidth + dx));
      }
      if (drag.axis === 'height' || drag.axis === 'both') {
        next.height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, drag.startHeight + dy));
      }
      return next;
    });
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
      setCardSize(cardId, sizeRef.current);
    },
    [cardId, setCardSize]
  );

  return { size, startDrag, onDragMove, endDrag };
}
