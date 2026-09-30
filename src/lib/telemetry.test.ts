import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTelemetryStatus, reportAppActive, setTelemetryConsent } from './telemetry';

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('telemetry client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the status from the backend', async () => {
    const fetchMock = mockFetch({ available: true, consent: 'unset', eligible: false });
    const status = await getTelemetryStatus();
    expect(status).toEqual({ available: true, consent: 'unset', eligible: false });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/telemetry/status');
  });

  it('posts the consent choice', async () => {
    const fetchMock = mockFetch({ available: true, consent: 'granted', eligible: true });
    await setTelemetryConsent('granted');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/telemetry/consent');
    expect(JSON.parse(init.body)).toEqual({ consent: 'granted' });
  });

  it('never throws when reporting app start fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(() => reportAppActive()).not.toThrow();
    await Promise.resolve();
  });
});
