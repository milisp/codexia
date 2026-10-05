import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const addKeke = vi.fn().mockResolvedValue(undefined);
const login = vi.fn();
const statuses = vi.fn().mockResolvedValue({ linear: { signedIn: false, error: null } });
const addUnified = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/apiAdapt/kekeMcp', () => ({ addKekeMcpServer: (...args: unknown[]) => addKeke(...args), loginKekeMcpServer: (...args: unknown[]) => login(...args), readKekeMcpAuthStatuses: () => statuses() }));
vi.mock('@/services', () => ({ unifiedAddMcpServer: (...args: unknown[]) => addUnified(...args) }));
import { DefaultMcpServers } from './DefaultMcpServers';
beforeEach(() => vi.clearAllMocks());
describe('featured connector targets', () => {
  it('adds a Bot preset only to keke', async () => {
    const added = vi.fn();
    render(<DefaultMcpServers agent="keke" servers={{}} onServerAdded={added} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Linear' }));
    await waitFor(() => expect(added).toHaveBeenCalledOnce());
    expect(addKeke).toHaveBeenCalledWith('linear', { type: 'http', url: 'https://mcp.linear.app/mcp' });
    expect(addUnified).not.toHaveBeenCalled();
  });
  it('keeps Claude presets in the existing global scope', async () => {
    const added = vi.fn();
    render(<DefaultMcpServers agent="cc" cwd="/project" servers={{github:{}}} onServerAdded={added} />);
    expect(screen.getByRole('button', { name: 'Added GitHub' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add Context7' }));
    await waitFor(() => expect(added).toHaveBeenCalledOnce());
    expect(addUnified).toHaveBeenCalledWith(expect.objectContaining({ clientName:'cc', scope:'global', serverName:'context7', path:'/project' }));
    expect(addKeke).not.toHaveBeenCalled();
  });
  it('offers native authorization after adding a remote Bot connector', async () => {
    let complete!: () => void;
    login.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    render(<DefaultMcpServers agent="keke" servers={{linear: {}}} onServerAdded={vi.fn()} />);
    expect(screen.queryByText('Desktop Commander')).toBeNull();
    const signIn = await screen.findByRole('button', { name: 'Sign in to linear' });
    fireEvent.click(signIn);
    await screen.findByText('Authorizing…');
    expect(login).toHaveBeenCalledWith('linear');
    expect(addUnified).not.toHaveBeenCalled();
    statuses.mockResolvedValueOnce({ linear: { signedIn: true, error: null } });
    complete();
    await screen.findByRole('button', { name: 'Reauthorize linear' });
  });
  it('shows failed authorization beside the connector without claiming success', async () => {
    statuses.mockResolvedValue({ linear: { signedIn: false, error: null } });
    login.mockRejectedValueOnce(new Error('Provider rejected authorization'));
    render(<DefaultMcpServers agent="keke" servers={{linear: {}}} onServerAdded={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in to linear' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Provider rejected authorization');
    expect(screen.queryByRole('button', { name: 'Reauthorize linear' })).toBeNull();
  });

});
