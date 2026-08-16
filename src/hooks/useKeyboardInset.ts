import { useEffect } from 'react';

/**
 * Publishes the on-screen keyboard's height as the `--keyboard-inset` CSS
 * variable on the document root.
 *
 * iOS WKWebView does not resize the layout viewport when the keyboard opens —
 * it just covers the bottom of the page — so `100svh` stays full height and the
 * composer ends up underneath the keyboard. `visualViewport` is the only
 * reliable source for how much is actually covered.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      root.style.setProperty('--keyboard-inset', `${Math.max(0, Math.round(covered))}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
