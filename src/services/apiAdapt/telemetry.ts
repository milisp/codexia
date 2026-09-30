import { getJson, postJson } from './shared';

export type TelemetryConsent = 'unset' | 'granted' | 'denied';

export type TelemetryStatus = {
  /** An endpoint is built into the backend and DO_NOT_TRACK is not set. */
  available: boolean;
  consent: TelemetryConsent;
  /** The user has at least one bot; nothing is asked or reported before that. */
  eligible: boolean;
};

export async function getTelemetryStatus() {
  return await getJson<TelemetryStatus>('/api/telemetry/status');
}

export async function setTelemetryConsent(consent: TelemetryConsent) {
  return await postJson<TelemetryStatus>('/api/telemetry/consent', { consent });
}

/** Tell the backend the app started; it applies consent, bot and once-a-day gating. */
export async function reportAppActive() {
  await postJson('/api/telemetry/active');
}
