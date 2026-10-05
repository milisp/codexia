import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const addKeke = vi.fn().mockResolvedValue(undefined);
const addUnified = vi.fn().mockResolvedValue(undefined);
const addClaude = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/apiAdapt/kekeMcp', () => ({ addKekeMcpServer: (...args: unknown[]) => addKeke(...args) }));
vi.mock('@/services', () => ({ unifiedAddMcpServer: (...args: unknown[]) => addUnified(...args), ccMcpAdd: (...args: unknown[]) => addClaude(...args) }));
vi.mock('@/stores', () => ({ useAgentSettingsStore: () => ({ selectedAgent: 'codex' }), useWorkspaceStore: () => ({ cwd: '/tmp' }) }));
import { McpAddPanel } from './McpAddPanel';
beforeEach(() => vi.clearAllMocks());
describe('Bot custom connectors', () => {
  it('writes remote configuration and auth headers to keke, never Codex', async () => {
    const added = vi.fn();
    render(<McpAddPanel target="keke" onAdded={added} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Server name' }), { target: { value: ' custom ' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Server URL' }), { target: { value: 'https://example.com/mcp' } });
    fireEvent.click(screen.getByText('Authentication headers'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Authentication headers (JSON)' }), { target: { value: '{"Authorization":"Bearer test"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Server' }));
    await waitFor(() => expect(added).toHaveBeenCalledOnce());
    expect(addKeke).toHaveBeenCalledWith('custom', { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer test' } });
    expect(addUnified).not.toHaveBeenCalled();
    expect(addClaude).not.toHaveBeenCalled();
  });
  it('rejects malformed header maps without writing configuration', async () => {
    render(<McpAddPanel target="keke" onAdded={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Server name' }), { target: { value: 'custom' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Server URL' }), { target: { value: 'https://example.com/mcp' } });
    fireEvent.click(screen.getByText('Authentication headers'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Authentication headers (JSON)' }), { target: { value: '{"Authorization":42}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Server' }));
    expect(addKeke).not.toHaveBeenCalled();
    expect(addUnified).not.toHaveBeenCalled();
  });
});
