import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const addKeke = vi.fn().mockResolvedValue(undefined);
const addUnified = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/apiAdapt/kekeMcp', () => ({ addKekeMcpServer: (...args: unknown[]) => addKeke(...args) }));
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
});
