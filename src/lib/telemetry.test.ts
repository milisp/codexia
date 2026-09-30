import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings/useSettingsStore';
import { track } from './telemetry';

const URL = 'https://t.example/v1/events';

describe('telemetry', () => {
  const fetchMock = vi.fn().mockResolvedValue({});
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_TELEMETRY_URL', URL);
    useSettingsStore.setState({ telemetryConsent: 'granted' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is a no-op without consent', async () => {
    useSettingsStore.setState({ telemetryConsent: 'unset' });
    track('app_active');
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a no-op without an endpoint', async () => {
    vi.stubEnv('VITE_TELEMETRY_URL', '');
    track('app_active');
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends each event once per day, with only the allowed fields', async () => {
    track('app_active');
    track('app_active');
    track('bot_created');
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(init.body);
    expect(Object.keys(body)).toEqual(['events']);
    expect(body.events.map((e: { name: string }) => e.name)).toEqual(['app_active', 'bot_created']);
    for (const e of body.events) {
      expect(Object.keys(e).sort()).toEqual(['arch', 'name', 'platform', 'version']);
    }

    track('app_active');
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 86_400_000);
    track('app_active');
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
