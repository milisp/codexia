import type { useCardResize } from './useCardResize';

type ResizeHandlers = Pick<ReturnType<typeof useCardResize>, 'startDrag' | 'onDragMove' | 'endDrag'>;

/**
 * Right-edge (width), bottom-edge (height), and corner (both) drag handles for
 * a grid card. Renders nothing visible until hovered — the hit areas sit on
 * top of the card's own overflow-hidden content.
 */
export function CardResizeHandles({ startDrag, onDragMove, endDrag }: ResizeHandlers) {
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startDrag('width')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/40 z-10"
      />
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={startDrag('height')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize hover:bg-primary/40 z-10"
      />
      <div
        onPointerDown={startDrag('both')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize hover:bg-primary/50 z-20"
      />
    </>
  );
}
