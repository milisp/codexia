import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const addKeke = vi.fn().mockResolvedValue(undefined);
const login = vi.fn();
const tokenAuth = vi.fn();
const statuses = vi.fn().mockResolvedValue({ linear: { signedIn: false, error: null } });
const addUnified = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/apiAdapt/kekeMcp', () => ({ addKekeMcpServer: (...args: unknown[]) => addKeke(...args), loginKekeMcpServer: (...args: unknown[]) => login(...args), readKekeMcpAuthStatuses: () => statuses(), authorizeGitHubMcp: (...args: unknown[]) => tokenAuth(...args) }));
vi.mock('@/services', () => ({ unifiedAddMcpServer: (...args: unknown[]) => addUnified(...args) }));
import { DefaultMcpServers } from './DefaultMcpServers';
beforeEach(() => { vi.clearAllMocks(); login.mockResolvedValue(undefined); tokenAuth.mockResolvedValue(undefined); statuses.mockResolvedValue({linear:{signedIn:false,error:null},github:{signedIn:false,error:null}}); });
describe('featured connector targets', () => {
  it('adds a Bot preset only to keke', async () => {
    const added = vi.fn();
    render(<DefaultMcpServers agent="keke" servers={{}} onServerAdded={added} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Linear' }));
    await waitFor(() => expect(added).toHaveBeenCalledOnce());
    expect(addKeke).toHaveBeenCalledWith('linear', { type: 'http', url: 'https://mcp.linear.app/mcp' });
    expect(addUnified).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith('linear');
    expect(addKeke.mock.invocationCallOrder[0]).toBeLessThan(login.mock.invocationCallOrder[0]);
  });
  it('keeps Claude presets in the existing global scope', async () => {
    const added = vi.fn();
    render(<DefaultMcpServers agent="cc" cwd="/project" servers={{github:{}}} onServerAdded={added} />);
    expect(screen.queryByRole('button', { name: 'Add GitHub' })).toBeNull();
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
    expect(screen.queryByText('Added')).toBeNull();
    const signIn = await screen.findByRole('button', { name: 'Authorize linear' });
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
    fireEvent.click(await screen.findByRole('button', { name: 'Authorize linear' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Provider rejected authorization');
    expect(screen.queryByRole('button', { name: 'Reauthorize linear' })).toBeNull();
  });

  it('opens GitHub token authorization immediately after Add and skips dynamic registration', async () => {
    render(<DefaultMcpServers agent="keke" servers={{}} onServerAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', {name:'Add GitHub'}));
    await screen.findByRole('dialog');
    const input = screen.getByLabelText('GitHub token');
    expect(input.getAttribute('type')).toBe('password');
    fireEvent.change(input, {target:{value:' fixture-token '}});
    fireEvent.click(screen.getByRole('button', {name:'Authorize'}));
    await waitFor(() => expect(tokenAuth).toHaveBeenCalledWith('github','fixture-token'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(login).not.toHaveBeenCalled();
  });
  it('keeps GitHub token errors actionable and allows retry for existing configurations', async () => {
    tokenAuth.mockRejectedValueOnce(new Error('Error: Invalid token'));
    render(<DefaultMcpServers agent="keke" servers={{github:{type:'http',url:'https://api.githubcopilot.com/mcp/'}}} onServerAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', {name:'Authorize github'}));
    fireEvent.change(await screen.findByLabelText('GitHub token'), {target:{value:'fixture-token'}});
    fireEvent.click(screen.getByRole('button', {name:'Authorize'}));
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid token');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });
  it('does not start authorization for public connectors', async () => {
    const added = vi.fn();
    render(<DefaultMcpServers agent="keke" servers={{}} onServerAdded={added} />);
    fireEvent.click(screen.getByRole('button', {name:'Add DeepWiki'}));
    await waitFor(() => expect(added).toHaveBeenCalledOnce());
    expect(login).not.toHaveBeenCalled();
    expect(tokenAuth).not.toHaveBeenCalled();
  });

});
