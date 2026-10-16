import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/acp/useAcpAgents', () => ({
  useAcpAgents: () => [
    { id: 'keke', name: 'Keke', command: 'keke', args: [], env: {}, available: true },
  ],
}));
vi.mock('@/services/apiAdapt/acp', () => ({ acpStop: vi.fn() }));

import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentSwitcher } from './AgentSwitcher';

beforeEach(() => {
  useAcpStore.setState({ active: false, agentId: 'keke', connectionId: null });
  useAgentSettingsStore.setState({ selectedAgent: 'codex' });
  useWorkspaceStore.setState({
    projects: ['/projects/a', '/projects/b'],
    historyProjects: ['/projects/gone', '/projects/b', '/projects/a'],
    cwd: null,
  });
});

describe('AgentSwitcher', () => {
  it('lists ACP agents and picks the most recent project when switching to one', () => {
    render(<AgentSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Keke' }));

    expect(useAcpStore.getState().active).toBe(true);
    // '/projects/gone' was removed, so the most recent remaining project wins.
    expect(useWorkspaceStore.getState().cwd).toBe('/projects/b');
  });

  it('keeps an already selected project', () => {
    useWorkspaceStore.setState({ cwd: '/projects/a' });
    render(<AgentSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Keke' }));

    expect(useWorkspaceStore.getState().cwd).toBe('/projects/a');
  });

  it('only offers built-in agents in builtin scope', () => {
    render(<AgentSwitcher scope="builtin" />);

    expect(screen.queryByRole('button', { name: 'Keke' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Claude Agent' }));
    expect(useAgentSettingsStore.getState().selectedAgent).toBe('cc');
  });
});
