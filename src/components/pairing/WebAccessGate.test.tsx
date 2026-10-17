import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebAccessStore } from '@/stores/useWebAccessStore';
import { WebAccessGate } from './WebAccessGate';

vi.mock('@/hooks/runtime', () => ({
  buildUrl: (path: string) => `http://server${path}`,
  authHeaders: () => {
    const token = useWebAccessStore.getState().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
}));

/** A server that accepts only `good`, or every request when `open`. */
function stubServer({ open = false } = {}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    const ok = open || auth === 'Bearer good';
    return new Response('{}', { status: ok ? 200 : 401 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('WebAccessGate', () => {
  beforeEach(() => useWebAccessStore.setState({ token: null }));
  afterEach(() => vi.unstubAllGlobals());

  it('renders the app when the server needs no token', async () => {
    stubServer({ open: true });
    render(<WebAccessGate>app</WebAccessGate>);
    expect(await screen.findByText('app')).toBeTruthy();
  });

  it('signs in with a valid token', async () => {
    stubServer();
    render(<WebAccessGate>app</WebAccessGate>);
    fireEvent.change(await screen.findByLabelText('Token'), { target: { value: 'good' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('app')).toBeTruthy();
    expect(useWebAccessStore.getState().token).toBe('good');
  });

  it('keeps the gate and reports a rejected token', async () => {
    stubServer();
    render(<WebAccessGate>app</WebAccessGate>);
    fireEvent.change(await screen.findByLabelText('Token'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('The server rejected this token.')).toBeTruthy();
    expect(screen.queryByText('app')).toBeNull();
    expect(useWebAccessStore.getState().token).toBeNull();
  });

  it('offers a retry when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<WebAccessGate>app</WebAccessGate>);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    stubServer({ open: true });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('app')).toBeTruthy();
  });
});
