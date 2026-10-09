import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Node's optional localStorage can be unavailable in Vitest workers.
const storageEntries = new Map<string, string>();
const storage: Storage = {
  get length() {
    return storageEntries.size;
  },
  clear: () => storageEntries.clear(),
  getItem: (key) => storageEntries.get(String(key)) ?? null,
  key: (index) => Array.from(storageEntries.keys())[index] ?? null,
  removeItem: (key) => {
    storageEntries.delete(String(key));
  },
  setItem: (key, value) => {
    storageEntries.set(String(key), String(value));
  },
};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storage,
});

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
