import { defineConfig } from 'vitest/config';

// Own config so the repo-root vitest config (jsdom, src/) is never picked up.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], environment: 'node' } });
