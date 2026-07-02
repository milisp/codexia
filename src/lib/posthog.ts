import posthog from 'posthog-js';
import { v4 as uuidv4 } from 'uuid';

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

let initialized = false;

export function initPosthog() {
  if (!key || initialized || import.meta.env.DEV) return;
  initialized = true;

  const STORAGE_KEY = 'codexia-anon-id';
  let anonId = localStorage.getItem(STORAGE_KEY);
  if (!anonId) {
    anonId = uuidv4();
    localStorage.setItem(STORAGE_KEY, anonId);
  }

  posthog.init(key, {
    api_host: host,
    person_profiles: 'identified_only',
    loaded: (ph) => {
      ph.identify(anonId!);
    },
  });
}

export { posthog };
