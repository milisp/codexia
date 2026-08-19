import { useEffect } from 'react';
import { captureTodo, getCapturableSelection } from '@/features/todos/capture';

const DOUBLE_TAP_MS = 400;

/** Tapping Shift twice turns the current text selection into a todo. */
export function useDoubleShiftCapture() {
  useEffect(() => {
    let lastShiftAt = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Shift' || event.repeat) return;
      // A Shift held as part of a combo (Shift+Enter, Cmd+Shift+K) is not a tap.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const now = Date.now();
      if (now - lastShiftAt > DOUBLE_TAP_MS) {
        lastShiftAt = now;
        return;
      }
      lastShiftAt = 0;

      const selection = getCapturableSelection();
      if (!selection) return;
      captureTodo(selection.text);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
