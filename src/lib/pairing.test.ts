import { describe, expect, it } from 'vitest';
import { buildPairingUri, parsePairingUri } from './pairing';

const desktop = {
  name: 'codexia-mac',
  host: 'codexia-mac.tail1234.ts.net',
  port: 7420,
  token: 'a'.repeat(64),
};

describe('pairing uri', () => {
  it('round-trips a desktop', () => {
    expect(parsePairingUri(buildPairingUri(desktop))).toEqual(desktop);
  });

  it('falls back to the default port and an empty name', () => {
    const parsed = parsePairingUri('codexia://pair?host=mac.ts.net&token=abc');
    expect(parsed).toEqual({ name: '', host: 'mac.ts.net', port: 7420, token: 'abc' });
  });

  it('rejects codes that are not pairings', () => {
    expect(parsePairingUri('https://example.com')).toBeNull();
    expect(parsePairingUri('codexia://pair?host=mac.ts.net')).toBeNull();
    expect(parsePairingUri('codexia://pair?token=abc')).toBeNull();
    expect(parsePairingUri('')).toBeNull();
  });
});
