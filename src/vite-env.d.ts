/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Anonymous telemetry endpoint. Unset disables telemetry and its consent prompt. */
  readonly VITE_TELEMETRY_URL?: string;
}

/** `package.json` version, injected by Vite's `define`. */
declare const __APP_VERSION__: string;
