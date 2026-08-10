import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest runs with `globals: false`, so RTL cannot register its own auto-cleanup and
// mounted trees would leak into the next test's queries.
afterEach(cleanup);

// jsdom ships neither of these, and Radix primitives call both.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
