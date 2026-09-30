import { describe, expect, it } from 'vitest';
import { parseBatch, parseEvent } from '../src/validate';

const ok = { name: 'app_active', version: '0.52.0', platform: 'macos', arch: 'aarch64' };

describe('parseEvent', () => {
  it('accepts a valid event and strips extra fields', () => {
    expect(parseEvent({ ...ok, userId: 'x' })).toEqual(ok);
  });
  it('accepts prerelease versions', () => {
    expect(parseEvent({ ...ok, version: '1.2.3-beta.1' })).not.toBeNull();
  });
  it.each([
    { name: 'nope' },
    { version: '1.2' },
    { version: 'v1.2.3' },
    { version: `1.2.3-${'a'.repeat(40)}` },
    { platform: 'plan9' },
    { arch: 'arm' },
  ])('rejects %j', (patch) => {
    expect(parseEvent({ ...ok, ...patch })).toBeNull();
  });
  it('rejects non-objects', () => {
    expect(parseEvent(null)).toBeNull();
    expect(parseEvent('x')).toBeNull();
  });
});

describe('parseBatch', () => {
  it('drops invalid events but keeps valid ones', () => {
    expect(parseBatch({ events: [ok, { ...ok, name: 'x' }] })).toEqual([ok]);
  });
  it('rejects more than 20 events and bad shapes', () => {
    expect(parseBatch({ events: Array(21).fill(ok) })).toBeNull();
    expect(parseBatch({})).toBeNull();
    expect(parseBatch([])).toBeNull();
  });
});
