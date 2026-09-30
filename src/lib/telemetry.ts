/**
 * Anonymous, opt-in usage counters live in the backend: one consent and one
 * once-per-day dedupe per machine (`~/.codexia/telemetry.json`), shared by
 * every client. The frontend only reads and sets consent and announces startup.
 * See docs/PRIVACY.md.
 */
export {
  getTelemetryStatus,
  setTelemetryConsent,
  type TelemetryConsent,
  type TelemetryStatus,
} from '@/services/apiAdapt/telemetry';

import { reportAppActive as postAppActive } from '@/services/apiAdapt/telemetry';

/** Fire-and-forget; a failure must never surface to the user. */
export function reportAppActive(): void {
  postAppActive().catch(() => {});
}
