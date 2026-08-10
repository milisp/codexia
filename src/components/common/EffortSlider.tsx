import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type EffortSliderProps<T extends string> = {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** Discrete slider used to pick an effort level from an ordered option list. */
export function EffortSlider<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: EffortSliderProps<T>) {
  const enabled = !disabled && options.length > 0;
  const trackRef = useRef<HTMLDivElement>(null);
  // While dragging we track the index locally so the parent is not notified on every move.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragging = dragIndex !== null;

  const last = Math.max(1, options.length - 1);
  const index = dragIndex ?? Math.max(0, options.indexOf(value));
  const percent = (index / last) * 100;
  const displayValue = options[index] ?? value;

  // Maps a pointer x position to the nearest option index.
  const indexFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return null;
      const rect = track.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      return Math.round(Math.min(1, Math.max(0, ratio)) * last);
    },
    [last]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    let current = indexFromPointer(e.clientX) ?? index;
    setDragIndex(current);

    const onMove = (ev: PointerEvent) => {
      const next = indexFromPointer(ev.clientX);
      if (next === null || next === current) return;
      current = next;
      setDragIndex(next);
    };
    const onUp = (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      setDragIndex(null);
      const picked = options[current];
      if (picked && picked !== value) onChange(picked);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[Math.min(last, Math.max(0, index + delta))];
    if (next && next !== value) onChange(next);
  };

  return (
    <div className={cn('border-t p-2 space-y-2', !enabled && 'opacity-40 pointer-events-none')}>
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-bold text-muted-foreground/70 tracking-wider">
          {label}
        </span>
        <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 capitalize">
          {displayValue}
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={enabled ? 0 : -1}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={index}
        aria-valuetext={displayValue}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative h-7 mx-2 touch-none select-none outline-none rounded-full',
          'focus-visible:ring-2 focus-visible:ring-ring/50',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        {/* tube */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3.5 rounded-full bg-muted border border-input/60 shadow-inner overflow-hidden">
          {/* filled portion */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
        {/* ticks */}
        {options.map((option, i) => (
          <span
            key={option}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-1 rounded-full transition-colors',
              i <= index ? 'bg-white/70' : 'bg-muted-foreground/40'
            )}
            style={{ left: `${(i / last) * 100}%` }}
          />
        ))}
        {/* thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-5 rounded-full',
            'bg-background border-2 border-indigo-500 shadow transition-[left,transform] duration-150',
            dragging && 'scale-110 shadow-md'
          )}
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  );
}
