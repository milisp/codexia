import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT || 1420);

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Run `ANALYZE=true bun run build` to generate dist/stats.html
      ...(process.env.ANALYZE ? [visualizer({ open: false, filename: "dist/stats.html", gzipSize: true })] : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Raise the warning threshold so large-but-expected chunks don't spam the output
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            // Ace editor + all language modes (loaded only when file editor opens)
            'vendor-ace': ['ace-builds', 'react-ace'],
            // Markdown editors + rendering (merged to avoid circular chunk)
            'vendor-markdown': ['react-markdown', 'remark-gfm', 'streamdown'],
            'vendor-md': ['react-markdown-editor-lite', 'markdown-it'],
            // Charts (Insights view)
            'vendor-recharts': ['recharts'],
            // Animation (Insights / git stats)
            'vendor-framer': ['framer-motion'],
            // All Radix primitives bundled together
            'vendor-radix': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-context-menu',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip',
              'radix-ui',
            ],
            // Analytics (lazy init, not on critical path)
            'vendor-analytics': ['posthog-js'],
            // Supabase (auth + realtime)
            'vendor-supabase': ['@supabase/supabase-js'],
            // i18n
            'vendor-i18n': ['i18next', 'react-i18next'],
            // Git diff
            'vendor-diff': ['@git-diff-view/react', 'diff'],
            // Terminal
            'vendor-xterm': ['xterm', 'xterm-addon-fit'],
          },
        },
      },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
          protocol: "ws",
          host,
          port: 1421,
        }
        : undefined,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: [
          "**/src-tauri/**",
          "**/src-tauri/gen/apple/**",
          "**/src/bindings/**",
          "**/target/**",
          "**/dist/**",
          "**/node_modules/**",
          "**/scripts/**",
          "**/docs/**",
          "**/README.md",
        ],
      },
    },
  };
});
