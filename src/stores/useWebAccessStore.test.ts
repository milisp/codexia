import { beforeEach, describe, expect, it } from 'vitest';
import { captureTokenFromFragment, useWebAccessStore } from './useWebAccessStore';

describe('captureTokenFromFragment', () => {
  beforeEach(() => useWebAccessStore.setState({ token: null }));

  it('stores the token and strips it from the address bar', () => {
    window.history.replaceState(null, '', '/bots?x=1#token=abc&tab=2');
    captureTokenFromFragment();
    expect(useWebAccessStore.getState().token).toBe('abc');
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/bots?x=1#tab=2'
    );
  });

  it('leaves the stored token alone without a fragment token', () => {
    useWebAccessStore.setState({ token: 'kept' });
    window.history.replaceState(null, '', '/');
    captureTokenFromFragment();
    expect(useWebAccessStore.getState().token).toBe('kept');
  });
});
